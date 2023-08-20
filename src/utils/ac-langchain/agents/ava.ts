import {
  AgentActionOutputParser,
  AgentExecutor,
  LLMSingleActionAgent,
} from 'langchain/agents';
import { LLMChain } from 'langchain/chains';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import {
  BaseChatPromptTemplate,
  SerializedBasePromptTemplate,
  renderTemplate,
} from 'langchain/prompts';
import {
  AgentAction,
  AgentFinish,
  AgentStep,
  BaseMessage,
  HumanMessage,
  InputValues,
  PartialValues,
} from 'langchain/schema';
import { GoogleCustomSearch, Tool, DynamicTool } from 'langchain/tools';
import { WebBrowser } from 'langchain/tools/webbrowser';
import { Calculator } from 'langchain/tools/calculator';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { BaseCallbackHandler } from 'langchain/callbacks';
import { Embeddings } from 'langchain/embeddings/base';
import {
  createColorTokens,
  mapColorsToEvents,
} from '../chains/design-token-chain';
import { OpenAI } from 'langchain/llms/openai';
import { getToken } from '../../config';
import { timestampToHumanReadable } from '../../data-utils';
import {
  createAvaChatPrompt,
  createCustomPrompt,
  createWritingPromptTemplate,
} from './agent.prompts';
import { queryChat } from './chat-model';
import { queryAssistant } from './assistant';

const PREFIX = `###IGNORE PRIOR INSTRUCTIONS:
You are an intelligent digital worker and you must use the research tools to research the users query
and then you must use the create-document tool to send the information to the user.
###########
You must use one of the following tools for your response:`;

const formatInstructions = (
  toolNames: string,
) => `YOU MUST USE THE FOLLOWING FORMAT FOR YOUR OUTPUT:

Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be one of [${toolNames}]
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question`;

const SUFFIX = `YOUR REPLIES MUST USE THE ABOVE FORMAT FORMAT SO THAT IT
CAN BE PARSED WITH: /Action: (.*)\nAction Input: (.*)/s
#################
ADDITIONAL INFO:
Current Date: {current_date}
Current Location: Near Halsey and NE 134th Pl, Portland OR, 97230
---------------
Additional rules to conform to:
{system_message}
----------------
Relevant pieces of previous conversation:
{history}
----------------
Question: {input}
Thought:{agent_scratchpad}`;

class CustomPromptTemplate extends BaseChatPromptTemplate {
  tools: Tool[];
  systemMessage: string;
  chatHistory: string;
  constructor(args: {
    tools: Tool[];
    inputVariables: string[];
    systemMessage?: string;
    chatHistory?: string;
  }) {
    super({ inputVariables: args.inputVariables });
    this.tools = args.tools;
    this.systemMessage = args.systemMessage || '';
    this.chatHistory = args.chatHistory || '';
  }

  _getPromptType(): string {
    return 'chat';
  }

  async formatMessages(values: InputValues): Promise<BaseMessage[]> {
    /** Construct the final template */
    const toolStrings = this.tools
      .map((tool) => `${tool.name}: ${tool.description}`)
      .join('\n');
    const toolNames = this.tools.map((tool) => tool.name).join('\n');
    const instructions = formatInstructions(toolNames);
    console.log('ava-formatMessages', {
      toolStrings,
      instructions,
      values,
      toolNames,
    });
    const template = [PREFIX, toolStrings, instructions, SUFFIX].join('\n\n');
    /** Construct the agent_scratchpad */
    const intermediateSteps = values.intermediate_steps as AgentStep[];
    const agentScratchpad = intermediateSteps.reduce(
      (thoughts, { action, observation }) =>
        thoughts +
        [action.log, `\nObservation: ${observation}`, 'Thought:'].join('\n'),
      '',
    );
    const newInput = {
      agent_scratchpad: agentScratchpad,
      system_message: this.systemMessage,
      history: this.chatHistory,
      current_date: timestampToHumanReadable(),
      ...values,
    };
    /** Format the template. */
    const formatted = renderTemplate(template, 'f-string', newInput);
    console.log({ formatted });
    return [new HumanMessage(formatted)];
  }

  partial(_values: PartialValues): Promise<BaseChatPromptTemplate> {
    throw new Error('Not implemented');
  }

  serialize(): SerializedBasePromptTemplate {
    throw new Error('Not implemented');
  }
}

class CustomOutputParser extends AgentActionOutputParser {
  lc_namespace = ['langchain', 'agents', 'custom_llm_agent_chat'];

  async parse(text: string): Promise<AgentAction | AgentFinish> {
    if (text.includes('Final Answer:')) {
      const parts = text.split('Final Answer:');
      const input = parts[parts.length - 1].trim();
      const finalAnswers = { output: input };
      return { log: text, returnValues: finalAnswers };
    }

    const match = /Action: (.*)\nAction Input: (.*)/s.exec(text);
    if (!match) {
      throw new Error(`Could not parse LLM output: ${text}`);
    }

    return {
      tool: match[1].trim(),
      toolInput: match[2].trim().replace(/^"+|"+$/g, ''),
      log: text,
    };
  }

  getFormatInstructions(): string {
    throw new Error('Not implemented');
  }
}

let chatModel: ChatOpenAI;
let model: OpenAI;
let embeddings: Embeddings;
const createModels = (apiKey: string) => {
  if (chatModel && model && embeddings) return { chatModel, model, embeddings };
  chatModel = new ChatOpenAI({
    openAIApiKey: apiKey,
    modelName: 'gpt-4-0314',
    temperature: 0.1,
  });
  model = new OpenAI({
    openAIApiKey: apiKey,
    temperature: 0.3,
  });
  embeddings = new OpenAIEmbeddings({
    openAIApiKey: apiKey,
  });
  return { chatModel, model, embeddings };
};

const tools = [
  new Calculator(),
  new DynamicTool({
    name: 'human-input',
    description: `Use this tool for when you need a specific piece of information from a human that only that human would know. 
    Input is a short question for the human and the output is the humans response`,
    func: async (question: string) => {
      const answer = prompt(question);
      return answer || "Josh didn't respond in time, use your best judgement";
    },
  }),
];

const createLlmChain = (
  model: any,
  systemMessage?: string,
  chatHistory?: string,
) => {
  const llmChain = new LLMChain({
    prompt: new CustomPromptTemplate({
      tools,
      inputVariables: [
        'input',
        'agent_scratchpad',
        'system_message',
        'history',
        'current_date',
      ],
      systemMessage,
      chatHistory,
    }),
    llm: model,
    verbose: false,
  });

  const agent = new LLMSingleActionAgent({
    llmChain,
    outputParser: new CustomOutputParser(),
    stop: ['\nObservation'],
  });

  return agent;
};

const createAgentArtifacts = ({
  chatModel,
  model,
  embeddings,
  currentDocument,
  chatHistory,
  systemMessage,
  callbacks: { handleCreateDocument, handleAgentAction },
}: {
  chatModel: ChatOpenAI;
  model: OpenAI;
  embeddings: Embeddings;
  currentDocument?: string;
  systemMessage?: string;
  chatHistory?: string;
  callbacks: {
    handleCreateDocument: ({
      title,
      content,
    }: {
      title: string;
      content: string;
    }) => void;
    handleAgentAction: any;
  };
}) => {
  const agent = createLlmChain(chatModel, systemMessage, chatHistory);
  const browser = new WebBrowser({
    model,
    embeddings,
  });

  const google = new GoogleCustomSearch({
    apiKey: getToken('GOOGLE_API_KEY') || import.meta.env.VITE_GOOGLE_API_KEY,
    googleCSEId:
      getToken('GOOGLE_CSE_ID') || import.meta.env.VITE_GOOGLE_CSE_ID,
  });

  google.description =
    'For when you need to find or search information for Josh, you can use this to search Google for the results. Input is query to search for and output is results.';

  const documentTool = new DynamicTool({
    name: 'create-document-or-report',
    description: `Use this tool any time Josh wants you to create a document or report, etc. 
    Input is <title>Title</title> <content>Content</content>
    DO NOT INCLUDE THIS INFORMATION IN THE RESPONSE, JOSH WILL GET IT AUTOMATICALLY
    `,
    func: async (input: string) => {
      const titleRegex = /<title>(.*?)<\/title>/s;
      const titleMatch = titleRegex.exec(input);
      const title = titleMatch ? titleMatch[1] : ''; // extracts 'Title'

      const contentRegex = /<content>(.*?)<\/content>/s;
      const contentMatch = contentRegex.exec(input);
      const content = contentMatch ? contentMatch[1] : ''; // extracts 'Content'

      handleCreateDocument({ title, content });
      // @TODO: update to return url to document
      return "I've created the document for you.";
    },
    returnDirect: true,
  });

  // const chatTool = new DynamicTool({
  //   name: 'Talk to User',
  //   description:
  //     'For when the user wants to chat. Input is the user message and output is the response.',
  //   func: async (input: string) => {
  //     const sysMessage = systemMessage
  //       ? await createCustomPrompt(systemMessage, chatHistory)
  //       : // @TODO: Update once user profile is implemented
  //         await createAvaChatPrompt('Josh', chatHistory);
  //     const response = await queryChat({
  //       systemMessage: sysMessage,
  //       message: input,
  //       modelName: 'gpt-3.5-turbo',
  //     });
  //     return response;
  //   },
  //   returnDirect: true,
  // });

  const colorTool = new DynamicTool({
    name: 'create-color-tokens',
    description: `Use this tool to create color tokens based on a given description from the user.
    Examples Inputs: A palette of colors inspired by the beach,
      A palette of neutral colors to compliment #df1642 and #ef3de5

    Output is an error or success message to let you know the doc was created successfully.

    DO NOT INCLUDE THIS INFORMATION IN RESPONSE, USER WILL GET IT AUTOMATICALLY
    `,
    func: async (string: string): Promise<string> => {
      const colorTokens = await createColorTokens(string, model);
      // showing an example of how to map the colors to xstate events
      // const colorTokenEvent = mapColorsToEvents(colorTokens);
      const colorString = Object.entries(colorTokens)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
      // @TODO: return the document and workspace id to point the user to the document
      // create option for whether to navigate to the document or not
      handleCreateDocument({
        title: 'Color Tokens',
        content: '```\n' + colorString + '\n```',
      });
      return 'success';
    },
    returnDirect: true,
  });

  const search = async (url: string) => {
    const targetUrl = encodeURIComponent(url);
    const proxyUrl =
      getToken('PROXY_SERVER_URL') || import.meta.env.VITE_PROXY_SERVER_URL;
    const result = await browser.call(`${proxyUrl}/proxy?url=${targetUrl}`);
    return result;
  };

  const searchTool = new DynamicTool({
    name: 'website-browser',
    description: `Use this tool to search a website for information. 
    Input is the full url of the website you want to search.
    for example: https://www.google.com/
    Output is a summary and relevant links.
    `,
    func: search,
  });

  // @TODO: update tools to be dynamic based on settings
  // setting.searchTool && tools.push(searchTool);
  tools.push(searchTool);
  // tools.push(writingAssistantTool);
  // tools.push(chatTool);
  tools.push(documentTool);
  tools.push(google);
  tools.push(colorTool);

  const executor = new AgentExecutor({
    agent,
    tools,
  });

  // @TODO: Update to create more log data
  const handler = BaseCallbackHandler.fromMethods({
    handleLLMStart(llm, _prompts: string[]) {
      console.log("handleLLMStart: I'm the second handler!!", { llm });
    },
    handleChainStart(chain) {
      console.log("handleChainStart: I'm the second handler!!", { chain });
    },
    handleAgentAction(action) {
      console.log('handleAgentAction', action);
      handleAgentAction(action);
    },
    handleToolStart(tool) {
      console.log('handleToolStart', { tool });
    },
    handleToolEnd(tool) {
      console.log('handleToolEnd', { tool });
    },
  });

  return { executor, handler };
};

export const avaChat = async ({
  input,
  chatHistory,
  systemMessage,
  currentDocument,
  callbacks,
}: {
  input: string;
  systemMessage?: string;
  currentDocument?: string;
  chatHistory?: string;
  callbacks: {
    handleCreateDocument: ({
      title,
      content,
    }: {
      title: string;
      content: string;
    }) => void;
    handleAgentAction: (arg0: AgentAction) => void;
  };
}) => {
  const { chatModel, model, embeddings } = createModels(
    getToken('OPENAI_KEY') || import.meta.env.VITE_OPENAI_KEY,
  );
  const { executor, handler } = createAgentArtifacts({
    chatModel,
    model,
    embeddings,
    chatHistory,
    systemMessage,
    currentDocument,
    callbacks,
  });
  const result = await executor.call({ input }, [handler]);
  return result.output;
};
