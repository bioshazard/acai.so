import { Dispatch, SetStateAction, useContext, useState } from 'react';
import { noteChain } from '../../lib/ac-langchain/chains/notes-chain';
import {
  GlobalStateContext,
  GlobalStateContextValue,
} from '../../context/GlobalStateContext';
import { useNavigate, useParams } from 'react-router-dom';
import { toastifyInfo } from '../Toast';
import { Tab } from '../../state';

export type VoiceState = 'idle' | 'ava' | 'notes' | 'voice';
export type TTSState = 'bark' | 'elevenlabs' | 'webSpeech';

interface Command {
  commands: string[];
  action: (
    setUserTranscript: React.Dispatch<React.SetStateAction<string>>,
    setVoiceRecognitionState: React.Dispatch<React.SetStateAction<VoiceState>>,
    setSynthesisMode?: React.Dispatch<React.SetStateAction<TTSState>>,
  ) => Promise<void> | void;
  toastMessage?: string;
}

export const setStatesAndToast = (
  setUserTranscript: React.Dispatch<React.SetStateAction<string>>,
  setVoiceRecognitionState: React.Dispatch<React.SetStateAction<VoiceState>>,
  transcript: string,
  recognitionState: VoiceState,
) => {
  setUserTranscript(transcript);
  setVoiceRecognitionState(recognitionState);
};

export const useVoiceCommands = () => {
  const [userTranscript, setUserTranscript] = useState('');
  const [voiceRecognitionState, setVoiceRecognitionState] =
    useState<VoiceState>('idle');
  const [synthesisMode, setSynthesisMode] = useState<TTSState>('bark');
  const globalServices: GlobalStateContextValue =
    useContext(GlobalStateContext);
  const navigate = useNavigate();
  const { workspaceId: rawWorkspaceId } = useParams<{
    workspaceId: string;
    domain: string;
    id: string;
  }>();

  const workspaceId = rawWorkspaceId || 'docs';
  // @TODO: Pull out experimental commands into a separate file
  // Update the createCommand function to take an object as a parameter
  const createCommand = ({
    commands,
    recognitionState,
    toastMessage,
    action,
  }: {
    commands: string[];
    recognitionState: VoiceState;
    toastMessage?: string;
    action?: (
      setUserTranscript: Dispatch<SetStateAction<string>>,
      setVoiceRecognitionState: Dispatch<SetStateAction<VoiceState>>,
      setSynthesisMode?: Dispatch<SetStateAction<TTSState>>,
    ) => Promise<void> | void;
  }): Command => ({
    commands,
    action:
      action ||
      ((setUserTranscript, setVoiceRecognitionState) =>
        setStatesAndToast(
          setUserTranscript,
          setVoiceRecognitionState,
          '',
          recognitionState,
        )),
    toastMessage,
  });

  // Handler function for 'ready' command, used when finished creating notes
  const handleReadyCommand = async (
    setUserTranscript: Dispatch<SetStateAction<string>>,
    setVoiceRecognitionState: Dispatch<SetStateAction<VoiceState>>,
  ) => {
    const notes = await noteChain(userTranscript);
    const newTab: Tab = {
      id: Date.now().toString(),
      title: 'Notes',
      content: notes,
      workspaceId,
      filetype: 'markdown',
      autoSave: true,
      canEdit: true,
      systemNote: '',
      isContext: true,
      createdAt: Date.now().toString(),
      lastUpdated: Date.now().toString(),
    };
    globalServices.appStateService.send({ type: 'ADD_TAB', tab: newTab });
    setTimeout(() => {
      navigate(`/${workspaceId}/documents/${newTab.id}`);
    }, 150);
    setStatesAndToast(setUserTranscript, setVoiceRecognitionState, '', 'idle');
  };

  /**
   * commands: Array of strings that will trigger the command
   * recognitionState: The state that the voice recognition will be set to when the command is triggered
   * toastMessage: The message that will be displayed in the toast
   * action: The function that will be called when the command is triggered
   */
  const config: Command[] = [
    createCommand({
      commands: ['ava', 'eva'],
      recognitionState: 'ava',
      toastMessage: 'Agent is listening',
    }),
    createCommand({
      commands: ['take notes'],
      recognitionState: 'notes',
      toastMessage: 'Taking notes',
    }),
    createCommand({
      commands: ['voice'],
      recognitionState: 'voice',
      toastMessage: 'Voice to voice active',
    }),
    createCommand({
      commands: ['cancel'],
      recognitionState: 'idle',
      toastMessage: 'Going Idle',
    }),
    createCommand({
      commands: ['ready'],
      recognitionState: 'idle',
      toastMessage: 'Notes being created',
      action: handleReadyCommand,
    }),
  ];

  const handleVoiceCommand = async (t: string) => {
    const command = config.find((c) => c.commands.includes(t.toLowerCase()));

    if (command) {
      if (command.toastMessage) {
        toastifyInfo(command.toastMessage);
      }
      if (command.action) {
        await command.action(
          setUserTranscript,
          setVoiceRecognitionState,
          setSynthesisMode,
        );
      }
    }
  };

  return {
    userTranscript,
    setUserTranscript,
    voiceRecognitionState,
    setVoiceRecognitionState,
    synthesisMode,
    setSynthesisMode,
    handleVoiceCommand,
  };
};
