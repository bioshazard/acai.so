/* eslint-disable @typescript-eslint/ban-ts-comment */
import React, {
  useState,
  useEffect,
  useCallback,
  ReactNode,
  useRef,
  useLayoutEffect,
} from 'react';
// eslint-disable-next-line import/named
import { Editor, Range, Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
// eslint-disable-next-line import/no-unresolved
import { useCompletion } from 'ai/react';
import tippy from 'tippy.js';
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  MessageSquarePlus,
  Text,
  TextQuote,
  Image as ImageIcon,
  Code,
  CheckSquare,
} from 'lucide-react';
import LoadingCircle from '../loading-circle';
import Magic from '../magic';
import { toastifyError } from '../../Toast';

interface CommandItemProps {
  title: string;
  description: string;
  icon: ReactNode;
}

interface CommandProps {
  editor: Editor;
  range: Range;
}

const Command = Extension.create({
  name: 'slash-command',
  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({
          editor,
          range,
          props,
        }: {
          editor: Editor;
          range: Range;
          props: any;
        }) => {
          props.command({ editor, range });
        },
      },
    };
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

const getSuggestionItems = ({ query }: { query: string }) => {
  return [
    {
      title: 'Continue writing',
      description: 'Use AI to expand your thoughts.',
      searchTerms: ['gpt'],
      icon: <Magic className="w-7 h-7 text-black" />,
    },
    // {
    //   title: 'Send Feedback',
    //   description: 'Let us know how we can improve.',
    //   icon: <MessageSquarePlus size={18} />,
    //   command: ({ editor, range }: CommandProps) => {
    //     editor.chain().focus().deleteRange(range).run();
    //     window.open('/feedback', '_blank');
    //   },
    // },
    {
      title: 'Text',
      description: 'Just start typing with plain text.',
      searchTerms: ['p', 'paragraph'],
      icon: <Text size={18} />,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleNode('paragraph', 'paragraph')
          .run();
      },
    },
    // {
    //   title: 'To-do List',
    //   description: 'Track tasks with a to-do list.',
    //   searchTerms: ['todo', 'task', 'list', 'check', 'checkbox'],
    //   icon: <CheckSquare size={18} />,
    //   command: ({ editor, range }: CommandProps) => {
    //     editor.chain().focus().deleteRange(range).toggleTaskList().run();
    //   },
    // },
    {
      title: 'Heading 1',
      description: 'Big section heading.',
      searchTerms: ['title', 'big', 'large'],
      icon: <Heading1 size={18} />,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode('heading', { level: 1 })
          .run();
      },
    },
    {
      title: 'Heading 2',
      description: 'Medium section heading.',
      searchTerms: ['subtitle', 'medium'],
      icon: <Heading2 size={18} />,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode('heading', { level: 2 })
          .run();
      },
    },
    {
      title: 'Heading 3',
      description: 'Small section heading.',
      searchTerms: ['subtitle', 'small'],
      icon: <Heading3 size={18} />,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode('heading', { level: 3 })
          .run();
      },
    },
    {
      title: 'Bullet List',
      description: 'Create a simple bullet list.',
      searchTerms: ['unordered', 'point'],
      icon: <List size={18} />,
      command: ({ editor, range }: CommandProps) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run();
      },
    },
    {
      title: 'Numbered List',
      description: 'Create a list with numbering.',
      searchTerms: ['ordered'],
      icon: <ListOrdered size={18} />,
      command: ({ editor, range }: CommandProps) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      },
    },
    {
      title: 'Quote',
      description: 'Capture a quote.',
      searchTerms: ['blockquote'],
      icon: <TextQuote size={18} />,
      command: ({ editor, range }: CommandProps) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleNode('paragraph', 'paragraph')
          .toggleBlockquote()
          .run(),
    },
    {
      title: 'Code',
      description: 'Capture a code snippet.',
      searchTerms: ['codeblock'],
      icon: <Code size={18} />,
      command: ({ editor, range }: CommandProps) =>
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
    },
    // {
    //   title: 'Image',
    //   description: 'Upload an image from your computer.',
    //   searchTerms: ['photo', 'picture', 'media'],
    //   icon: <ImageIcon size={18} />,
    //   command: ({ editor, range }: CommandProps) => {
    //     editor.chain().focus().deleteRange(range).run();
    //     // upload image
    //     const input = document.createElement('input');
    //     input.type = 'file';
    //     input.accept = 'image/*';
    //     input.onchange = async (event) => {
    //       if (input.files?.length) {
    //         const file = input.files[0];
    //         return handleImageUpload(file, editor.view, event);
    //       }
    //     };
    //     input.click();
    //   },
    // },
  ].filter((item) => {
    if (typeof query === 'string' && query.length > 0) {
      const search = query.toLowerCase();
      return (
        item.title.toLowerCase().includes(search) ||
        item.description.toLowerCase().includes(search) ||
        (item.searchTerms &&
          item.searchTerms.some((term: string) => term.includes(search)))
      );
    }
    return true;
  });
};

export const updateScrollView = (container: HTMLElement, item: HTMLElement) => {
  const containerHeight = container.offsetHeight;
  const itemHeight = item ? item.offsetHeight : 0;

  const top = item.offsetTop;
  const bottom = top + itemHeight;

  if (top < container.scrollTop) {
    container.scrollTop -= container.scrollTop - top + 5;
  } else if (bottom > containerHeight + container.scrollTop) {
    container.scrollTop += bottom - containerHeight - container.scrollTop + 5;
  }
};

const CommandList = ({
  items,
  command,
  editor,
  range,
  hidePopup,
  isOpen,
}: {
  items: CommandItemProps[];
  command: any;
  editor: any;
  range: any;
  hidePopup: () => void;
  isOpen: boolean;
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { complete, isLoading } = useCompletion({
    id: 'novel',
    api: '/api/generate',
    onResponse: (response) => {
      if (response.status === 429) {
        toastifyError('You have reached your request limit for the day.');
        return;
      }
      editor.chain().focus().deleteRange(range).run();
    },
    onFinish: (_prompt, completion) => {
      // highlight the generated text
      editor.commands.setTextSelection({
        from: range.from,
        to: range.from + completion.length,
      });
    },
    onError: () => {
      toastifyError('Something went wrong.');
    },
  });

  const selectItem = useCallback(
    (index: number) => {
      const item = items[index];

      if (item) {
        if (item.title === 'Continue writing') {
          // we're using this for now until we can figure out a way to stream markdown text with proper formatting: https://github.com/steven-tey/novel/discussions/7
          complete(editor.getText());
          // complete(editor.storage.markdown.getMarkdown());
        } else {
          command(item);
        }
      }
    },
    [complete, command, editor, items],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const navigationKeys = ['ArrowUp', 'ArrowDown', 'Enter'];
      const closeKeys = [
        'ArrowLeft',
        'ArrowRight',
        'Backspace',
        'Escape',
        'Tab',
      ];
      if (
        isOpen &&
        (navigationKeys.includes(e.key) || closeKeys.includes(e.key))
      ) {
        if (navigationKeys.includes(e.key)) {
          e.preventDefault();
          if (e.key === 'ArrowUp') {
            setSelectedIndex((selectedIndex + items.length - 1) % items.length);
            return true;
          }
          if (e.key === 'ArrowDown') {
            setSelectedIndex((selectedIndex + 1) % items.length);
            return true;
          }
          if (e.key === 'Enter') {
            selectItem(selectedIndex);
            return true;
          }
        }
        if (closeKeys.includes(e.key)) {
          // Save current selection
          const { from, to } = editor.state.selection;
          hidePopup();
          // If Backspace was pressed, delete the '/' character
          if (e.key === 'Backspace') {
            editor
              .chain()
              .focus()
              .deleteRange({ from: from - 1, to })
              .run();
          } else {
            // Restore selection
            editor.chain().focus().setTextSelection({ from, to }).run();
          }
          return true;
        }
      }
      return false;
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [
    items,
    selectedIndex,
    setSelectedIndex,
    selectItem,
    hidePopup,
    isOpen,
    editor,
  ]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  useEffect(() => {
    const buttons = document.querySelectorAll('#slash-command button');
    const selectedButton = buttons[selectedIndex] as HTMLElement;
    selectedButton?.focus();
  }, [selectedIndex]);

  const commandListContainer = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const container = commandListContainer?.current;

    const item = container?.children[selectedIndex] as HTMLElement;

    if (item && container) updateScrollView(container, item);
  }, [selectedIndex]);

  return items.length > 0 ? (
    <div
      id="slash-command"
      ref={commandListContainer}
      className="z-50 h-auto max-h-[330px] w-72 overflow-y-auto scroll-smooth rounded-md border border-lighter bg-dark px-1 py-2 shadow-md transition-all"
    >
      {items.map((item: CommandItemProps, index: number) => {
        return (
          <button
            className={`flex w-full items-center space-x-2 rounded-md px-2 py-1 text-left text-sm text-acai-white hover:bg-darker ${
              index === selectedIndex ? 'bg-dark text-acai-white' : ''
            }`}
            key={index}
            onClick={() => selectItem(index)}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-lighter bg-dark">
              {item.title === 'Continue writing' && isLoading ? (
                <LoadingCircle />
              ) : (
                item.icon
              )}
            </div>
            <div>
              <p className="font-medium">{item.title}</p>
              <p className="text-xs text-acai-white">{item.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  ) : null;
};

const renderItems = () => {
  let component: ReactRenderer | null = null;
  let popup: any | null = null;
  let isOpen = false;

  return {
    onStart: (props: { editor: Editor; clientRect: DOMRect }) => {
      isOpen = true;
      component = new ReactRenderer(CommandList, {
        props: {
          ...props,
          hidePopup: () => {
            popup?.[0].hide();
            isOpen = false;
          },
          isOpen,
        },
        editor: props.editor,
      });

      // @ts-ignore
      popup = tippy('body', {
        getReferenceClientRect: props.clientRect,
        appendTo: () => document.body,
        content: component.element,
        showOnCreate: true,
        interactive: true,
        trigger: 'manual',
        placement: 'bottom-start',
        onShown: (instance) => {
          const firstItem = instance.popper.querySelector('button');
          firstItem && firstItem.focus();
        },
      });
    },
    onUpdate: (props: { editor: Editor; clientRect: DOMRect }) => {
      component?.updateProps(props);

      popup &&
        popup[0].setProps({
          getReferenceClientRect: props.clientRect,
        });
    },
    onKeyDown: (props: { event: KeyboardEvent }) => {
      if (props.event.key === 'Escape') {
        popup?.[0].hide();

        return true;
      }

      // @ts-ignore
      return component?.ref?.onKeyDown(props);
    },
    onExit: () => {
      popup?.[0].destroy();
      component?.destroy();
    },
  };
};

const SlashCommand = Command.configure({
  suggestion: {
    items: getSuggestionItems,
    render: renderItems,
  },
});

export default SlashCommand;
