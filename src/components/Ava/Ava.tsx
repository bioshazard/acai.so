import React, { useContext } from 'react';
import SBSidebar from '../../components/Sidebar';
import StorageMeter from '../../components/StorageMeter/StorageMeter';
import { ExpansionPanel } from '@chatscope/chat-ui-kit-react';
import NotificationCenter from '../../components/NotificationCenter';
import Chat from '../../components/Chat/Chat';
import SBSearch from '../../components/Search/Search';
import ScratchPad from '../../components/ScratchPad/ScratchPad';
import TokenManager from '../../components/TokenManager/token-manager';
import { useSelector } from '@xstate/react';
import { useAva } from '../../hooks/use-ava';
import {
  GlobalStateContext,
  GlobalStateContextValue,
} from '../../context/GlobalStateContext';
import { useNavigate } from 'react-router-dom';
import VoiceRecognition from '../VoiceRecognition/VoiceRecognition';
import { Tab } from '../../state';
import { VectorStoreContext } from '../../context/VectorStoreContext';
import { useMemoryVectorStore } from '../../hooks/use-memory-vectorstore';
import ChatModelDropdown from '../ChatSettings';

interface AvaProps {
  workspaceId: string;
  audioContext?: AudioContext;
  onVoiceActivation: (bool: boolean) => void;
}

export const Ava: React.FC<AvaProps> = ({
  workspaceId,
  onVoiceActivation,
  audioContext,
}) => {
  const {
    appStateService,
    uiStateService,
    agentStateService,
  }: GlobalStateContextValue = useContext(GlobalStateContext);
  const navigate = useNavigate();
  const workspace =
    appStateService.getSnapshot().context.workspaces[workspaceId];
  const systemNotes =
    useSelector(
      agentStateService,
      (state) => state.context[workspaceId]?.systemNotes,
    ) || '';
  const [avaResponse] = useAva();
  const contextTabs = workspace
    ? workspace.data.tiptap.tabs.filter((tab: Tab) => tab.isContext)
    : '';

  const { similaritySearchWithScore, filterAndCombineContent } = useContext(
    VectorStoreContext,
  ) as ReturnType<typeof useMemoryVectorStore>;

  const toggleAgentThoughts = () => {
    uiStateService.send({ type: 'TOGGLE_AGENT_THOUGHTS' });
  };

  const toggleAgentChat = () => {
    uiStateService.send({ type: 'TOGGLE_AGENT_CHAT' });
  };

  return (
    <SBSidebar>
      {' '}
      <ExpansionPanel
        data-ava-element="junk-drawer-panel-toggle"
        title="Knowledge"
      >
        <div className="flex flex-col">
          <SBSearch
            onSubmit={async (val: string) => {
              const response = await similaritySearchWithScore(val);
              const results = filterAndCombineContent(response, 0.75);
              const newTab: Tab = {
                id: Date.now().toString(),
                title: val,
                content: results,
                workspaceId,
                isContext: false,
                createdAt: new Date().toString(),
                lastUpdated: new Date().toString(),
                filetype: 'markdown',
                systemNote: '',
              };
              appStateService.send({ type: 'ADD_TAB', tab: newTab });
              navigate(`/${workspaceId}/${newTab.id}`);
            }}
          />
        </div>
        <StorageMeter />
      </ExpansionPanel>
      <ExpansionPanel title="Voice Synthesis">
        <VoiceRecognition
          onVoiceActivation={onVoiceActivation}
          audioContext={audioContext}
        />
      </ExpansionPanel>
      <ExpansionPanel title="Settings">
        <TokenManager />
        <ScratchPad
          placeholder="Custom Prompt"
          content={systemNotes}
          handleInputChange={(e) => {
            agentStateService.send({
              type: 'UPDATE_SYSTEM_NOTES',
              workspaceId: workspaceId,
              systemNotes: e.target.value,
            });
          }}
        />
        <ChatModelDropdown workspaceId={workspaceId} />
      </ExpansionPanel>
      <ExpansionPanel
        title="Logs"
        data-ava-element="TOGGLE_AGENT_THOUGHTS"
        onChange={toggleAgentThoughts}
        onClick={toggleAgentThoughts}
        isOpened={uiStateService.getSnapshot().context.agentThoughts}
      >
        <NotificationCenter
          placeholder="A place for AI to ponder 🤔"
          secondaryFilter="agent-thought"
        />
      </ExpansionPanel>
      <ExpansionPanel
        title="Chat"
        className="chat-panel"
        onChange={toggleAgentChat}
        onClick={toggleAgentChat}
        isOpened={uiStateService.getSnapshot().context.agentChat}
      >
        {workspaceId && (
          <Chat
            name="Ava"
            avatar=".."
            onSubmitHandler={async (message) => {
              const response = await avaResponse(message, systemNotes);
              return response;
            }}
          />
        )}
      </ExpansionPanel>
    </SBSidebar>
  );
};

export default Ava;
