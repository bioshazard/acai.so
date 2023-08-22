/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable react/jsx-no-comment-textnodes */
import React, { useContext, useEffect, useRef } from 'react';
import { Sidenav, initTE } from 'tw-elements';
import { useActor } from '@xstate/react';
import { useClickAway } from '@uidotdev/usehooks';
import { Link, useNavigate } from 'react-router-dom';
import { Workspace, handleCreateTab } from '../../state';
import { v4 as uuidv4 } from 'uuid';
import {
  GlobalStateContext,
  GlobalStateContextValue,
} from '../../context/GlobalStateContext';
import { ProjectLinks } from '../ProjectLinks/ProjectLinks';
import { ExpansionPanel } from '@chatscope/chat-ui-kit-react';

export const SideNav: React.FC = () => {
  const navigate = useNavigate();
  const globalServices: GlobalStateContextValue =
    useContext(GlobalStateContext);
  const [state, send] = useActor(globalServices.uiStateService);
  const navOpen = state.context.sideNavOpen;

  const navOpenRef = useRef(navOpen);
  navOpenRef.current = navOpen;

  const ref = useClickAway(() => {
    if (!navOpenRef.current) return;
    send({ type: 'TOGGLE_SIDE_NAV' });
  });

  useEffect(() => {
    initTE({ Sidenav });
  }, []);

  const createWorkspace = () => {
    const id = uuidv4().split('-')[0];
    const tabId = uuidv4().split('-')[0];
    const name = prompt('Enter a name for your new workspace');
    if (!name) return;
    const newWorkspace: Workspace = {
      id,
      name,
      createdAt: new Date().toString(),
      lastUpdated: new Date().toString(),
      private: false,
      settings: {
        webSpeechRecognition: false,
        tts: false,
        whisper: false,
      },
      data: {
        tiptap: {
          tabs: [
            {
              id: tabId,
              title: `Welcome to ${name}!`,
              content: '',
              isContext: false,
              systemNote: '',
              workspaceId: id,
              createdAt: new Date().toString(),
              lastUpdated: new Date().toString(),
              filetype: 'markdown',
            },
          ],
        },
        chat: {},
        agentLogs: {
          thoughts: {},
          errors: {},
        },
        agentTools: {
          calculator: false,
          weather: false,
          googleSearch: false,
          webBrowser: false,
          createDocument: false,
        },
        notes: '',
      },
    };
    globalServices.appStateService.send({
      type: 'ADD_WORKSPACE',
      workspace: newWorkspace,
    });

    globalServices.agentStateService.send({
      type: 'CREATE_AGENT',
      workspaceId: id,
    });
    navigate(`/${id}/${tabId}`);
  };

  // Function to create a new tab
  const createTab = async (workspaceId: string) => {
    // don't allow creating tabs in docs workspace on prod
    if (workspaceId === 'docs' && !import.meta.env.DEV) return;

    const title = prompt('Enter a name for your new tab');
    if (!title) return;
    const tab = await handleCreateTab({ title, content: '' }, workspaceId);
    globalServices.appStateService.send({
      type: 'ADD_TAB',
      tab,
    });
    setTimeout(() => {
      navigate(`/${workspaceId}/${tab.id}`);
    }, 250);
    globalServices.uiStateService.send({
      type: 'TOGGLE_SIDE_NAV',
      workspaceId,
    });
  };
  const workspaces = globalServices.appStateService.getSnapshot().context
    .workspaces as Record<string, Workspace>;
  return (
    <nav
      className="fixed flex flex-col left-0 top-0 z-[1035] max-h-screen w-60 -translate-x-full overflow-hidden bg-dark shadow-[0_4px_12px_0_rgba(0,0,0,0.07),_0_2px_4px_rgba(0,0,0,0.05)] data-[te-sidenav-hidden='false']:translate-x-0 dark:bg-dark"
      data-te-sidenav-init
      data-te-sidenav-hidden={!navOpen}
      data-te-sidenav-mode="push"
      data-te-sidenav-content="#content"
      ref={ref}
    >
      <ul
        className="relative m-0 list-none flex-grow max-height-[calc(100vh-4rem)] overflow-y-auto"
        data-te-sidenav-menu-ref
      >
        {Object.values(workspaces).map((workspace) => (
          <div className="relative pb-2" key={workspace.id}>
            <ExpansionPanel
              className="border-b border-darker border-b-solid border-l-0 border-r-0 border-t-0"
              title={workspace.name}
            >
              {workspace.data.tiptap.tabs.map((tab) => (
                <li
                  className="relative text-ellipsis overflow-hidden mb-2"
                  key={tab.id}
                >
                  <Link
                    className="flex h-6 cursor-pointer items-center leading-4 text-ellipsis rounded-[5px] py-4 text-[0.78rem] text-acai-white outline-none transition duration-300 ease-linear hover:bg-neutral-900 hover:outline-none focus:bg-neutral-900 hover:underline"
                    to={`/${workspace.id}/${tab.id}`}
                    data-te-sidenav-link-ref
                    onClick={() => {
                      globalServices.uiStateService.send({
                        type: 'TOGGLE_SIDE_NAV',
                      });
                    }}
                  >
                    <span>{tab.title}</span>
                  </Link>
                </li>
              ))}
              <button
                className="rounded-none text-acai-white hover:bg-neutral-900 text-xs w-full text-center transition duration-300 ease-linear"
                onClick={() => {
                  createTab(workspace.id);
                }}
              >
                +
              </button>
            </ExpansionPanel>
          </div>
        ))}
        <button
          className="w-full rounded-none text-acai-white text-xs hover:bg-neutral-900 hover:text-acai-white pl-2 text-left transition duration-300 ease-linear"
          onClick={createWorkspace}
        >
          New Workspace +
        </button>
      </ul>
      <ProjectLinks />
    </nav>
  );
};
