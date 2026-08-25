"use client";

import {
  ArrowUp,
  LoaderCircle,
  MessageSquarePlus,
  MoreVertical,
  Sparkles,
  Trash2,
} from "lucide-react";

import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { Button } from "../button";
import { Separator } from "../separator";

import {
  deleteThread,
  listThreads,
  loadThread,
  streamAgentChat,
  ThreadSummary,
} from "@/lib/agent";

import { ScrollArea } from "../scroll-area";
import { cn } from "@/lib/utils";
import { MarkdownMessage } from "./markdown-message";

const styles = {
  root: "flex h-svh overflow-hidden",

  overlay:
    "fixed inset-0 z-30 bg-foreground/20 backdrop-blur-[2px] md:hidden",

  aside:
    "fixed inset-y-0 left-0 z-40 flex w-[18.5rem] flex-col border-r border-sidebar-border bg-sidebar/95 backdrop-blur-xl transition-transform md:static md:translate-x-0",

  asideOpen: "translate-x-0",

  asideClosed: "-translate-x-full",

  brandRow:
    "flex items-center justify-between gap-2 px-4 pt-4 pb-3",

  brandLeft:
    "flex min-w-0 items-center gap-2.5",

  brandIcon:
    "flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground",

  brandIconSvg:
    "size-4",

  brandText:
    "min-w-0",

  brandTitle:
    "font-heading text-lg font-semibold tracking-tight",

  brandSubtitle:
    "truncate text-xs text-muted-foreground",

  mobileCloseBtn:
    "md:hidden",

  topActions:
    "space-y-3 px-3 pb-3",

  newChatBtn:
    "w-full justify-start gap-2 rounded-xl border-sidebar-border bg-card/70 text-sm",

  newChatIcon:
    "size-4",

  separator:
    "opacity-70",

  chatsSection:
    "flex min-h-0 flex-1 flex-col px-2 pt-3",

  chatsTitle:
    "mb-2 px-2 text-sm font-semibold text-sidebar-foreground",

  chatsScroll:
    "min-h-0 flex-1 px-1 pb-3",

  chatsEmpty:
    "px-2 py-3 text-sm leading-relaxed text-muted-foreground",

  threadList:
    "space-y-1",

  threadItem:
    "group relative flex w-full items-center rounded-xl transition-colors",

  threadBtn:
    "min-w-0 flex-1 rounded-xl px-3 py-2.5 text-left transition-colors disabled:opacity-50",

  threadBtnActive:
    "bg-sidebar-accent text-sidebar-accent-foreground",

  threadBtnIdle:
    "hover:bg-sidebar-accent/60",

  threadTitle:
    "line-clamp-2 text-sm font-medium leading-snug pr-6",

  threadTime:
    "mt-1 block text-xs text-muted-foreground",

  deleteBtn:
    "absolute right-1.5 top-1/2 z-10 flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus:opacity-100",

  deleteIcon:
    "size-3.5",

  footer:
    "mt-auto border-t border-sidebar-border p-3",

  main:
    "relative flex min-w-0 flex-1 flex-col",

  header:
    "flex h-14 shrink-0 items-center gap-3 border-b border-border/70 bg-background/50 px-3 backdrop-blur-md md:px-5",

  mobileMenuBtn:
    "md:hidden",

  menuIcon:
    "size-5",

  headerText:
    "min-w-0",

  headerTitle:
    "truncate text-base font-semibold",

  headerSubtitle:
    "truncate text-sm text-muted-foreground",

  chatColumn:
    "relative flex min-h-0 flex-1 flex-col",

  messagesScroll:
    "h-full min-h-0 flex-1",

  messagesInner:
    "mx-auto w-full max-w-3xl px-4 py-8 sm:px-6",

  emptyState:
    "flex min-h-[52vh] flex-col items-center justify-center text-center",

  emptyIcon:
    "mb-5 flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground",

  emptyIconSvg:
    "size-6",

  emptyTitle:
    "font-heading text-3xl font-semibold tracking-tight sm:text-4xl",

  emptyCopy:
    "mt-3 max-w-md text-base leading-relaxed text-muted-foreground",

  suggestions:
    "mt-8 flex flex-wrap justify-center gap-2",

  suggestionBtn:
    "rounded-full border-border/80 bg-card/80 px-3.5 text-[13px]",

  messageList:
    "space-y-6",

  messageRow:
    "message-enter flex w-full min-w-0",

  messageRowUser:
    "justify-end",

  messageRowAssistant:
    "justify-start",

  bubble:
    "min-w-0 max-w-[min(100%,42rem)] overflow-hidden break-words [overflow-wrap:anywhere]",

  bubbleUser:
    "rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-foreground",

  bubbleAssistant:
    "rounded-2xl rounded-bl-md bg-card px-4 py-3 text-foreground ring-1 ring-primary/15",

  bubbleSystem:
    "rounded-2xl bg-muted px-4 py-2.5 text-muted-foreground",

  userText:
    "whitespace-pre-wrap text-[15px] leading-7",

  composerWrap:
    "shrink-0 border-t border-border/60 bg-background/70 px-4 py-4 backdrop-blur-md sm:px-6",

  composerForm:
    "composer-glow mx-auto flex w-full max-w-3xl items-end gap-2 rounded-2xl border border-border/80 bg-card p-2.5",

  composerInput:
    "max-h-40 min-h-[44px] flex-1 resize-none border-0 bg-transparent px-3 py-2.5 text-[15px] shadow-none focus-visible:ring-0",

  sendBtn:
    "mb-0.5 size-10 shrink-0 rounded-xl",

  sendIcon:
    "size-4",

  sendIconSpin:
    "size-4 animate-spin",

  composerHint:
    "mx-auto mt-2.5 max-w-3xl text-center text-[11px] text-muted-foreground",
} as const;

type Props = {
  sessionToken: string;
  connections?: ReactNode;
  footer?: ReactNode;
};

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
};

const WELCOME =
  "Connect Google Calendar, then ask about today's agenda, create a Meet, or reschedule something.";

const SUGGESTIONS = [
  "What's on today?",
  "What's on tomorrow?",
  "Find a free slot tomorrow morning",
  "Create a meeting on 20th aug and keep the time as 10am for 30 minutes and keep moiz.euroshub@gmail.com as attendee",
];

function WelcomeMessage(): Message {
  return {
    id: "welcome",
    role: "assistant",
    content: WELCOME,
  };
}

function ChatPanel({
  sessionToken,
  connections,
  footer,
}: Props) {
  const [threadId, setThreadId] =
    useState(() =>
      crypto.randomUUID(),
    );

  const [messages, setMessages] =
    useState<Message[]>([
      WelcomeMessage(),
    ]);

  const [threads, setThreads] =
    useState<ThreadSummary[]>([]);

  const [prompt, setPrompt] =
    useState("");

  const [running, setRunning] =
    useState(false);

  const [loadingThread, setLoadingThread] =
    useState(false);

  const bottomRef =
    useRef<HTMLDivElement>(null);

  /**
   * Prevent deleting multiple chats
   * at the same time.
   */
  const [deletingThreadId, setDeletingThreadId] =
    useState<string | null>(null);

  /**
   * Refresh sidebar chats.
   */
  const refreshThreads =
    useCallback(async () => {
      try {
        const data =
          await listThreads(
            sessionToken,
          );

        setThreads(
          data.threads,
        );
      } catch (error) {
        console.error(
          "Failed to load threads:",
          error,
        );
      }
    }, [sessionToken]);

  useEffect(() => {
    refreshThreads();
  }, [refreshThreads]);

  /**
   * Automatically scroll to
   * the latest message.
   */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  /**
   * Start a completely new chat.
   */
  function startNewChat() {
    if (
      running ||
      loadingThread
    ) {
      return;
    }

    setThreadId(
      crypto.randomUUID(),
    );

    setMessages([
      WelcomeMessage(),
    ]);

    setPrompt("");
  }

  /**
   * Load an existing chat.
   */
  async function resumeThread(
    nextThreadId: string,
  ) {
    if (
      running ||
      loadingThread ||
      deletingThreadId ||
      nextThreadId === threadId
    ) {
      return;
    }

    setLoadingThread(true);

    try {
      const data =
        await loadThread(
          sessionToken,
          nextThreadId,
        );

      setThreadId(
        data.threadId,
      );

      setMessages(
        data.messages.length > 0
          ? data.messages
          : [WelcomeMessage()],
      );

      setPrompt("");
    } catch (error) {
      console.error(
        "Failed to load chat:",
        error,
      );

      setMessages(
        (current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "system",
            content:
              "Could not load the chat.",
          },
        ],
      );
    } finally {
      setLoadingThread(false);
    }
  }

  /**
   * Delete a chat.
   */
  async function handleDeleteThread(
    event: React.MouseEvent,
    targetThreadId: string,
    title: string,
  ) {
    /**
     * Don't allow the click to
     * open the chat.
     */
    event.stopPropagation();

    if (
      running ||
      loadingThread ||
      deletingThreadId
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Delete "${title || "Untitled Chat"}"?\n\nThis chat will be permanently deleted.`,
      );

    if (!confirmed) {
      return;
    }

    setDeletingThreadId(
      targetThreadId,
    );

    try {
      await deleteThread(
        sessionToken,
        targetThreadId,
      );

      /**
       * Remove it immediately from
       * the sidebar.
       */
      setThreads(
        (current) =>
          current.filter(
            (thread) =>
              thread.id !==
              targetThreadId,
          ),
      );

      /**
       * If the deleted chat is
       * currently open, start a
       * fresh chat.
       */
      if (
        targetThreadId ===
        threadId
      ) {
        setThreadId(
          crypto.randomUUID(),
        );

        setMessages([
          WelcomeMessage(),
        ]);

        setPrompt("");
      }
    } catch (error) {
      console.error(
        "Failed to delete chat:",
        error,
      );

      window.alert(
        "Could not delete this chat. Please try again.",
      );
    } finally {
      setDeletingThreadId(
        null,
      );
    }
  }

  /**
   * Send a message to the agent.
   *
   * IMPORTANT:
   *
   * We DO NOT create an empty
   * assistant message here.
   *
   * The assistant message is created
   * only when the first real token
   * arrives.
   */
  async function sendMessage(
    text: string,
  ) {
    const trimmed =
      text.trim();

    if (
      !trimmed ||
      running ||
      loadingThread
    ) {
      return;
    }

    setMessages(
      (current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "user",
          content: trimmed,
        },
      ],
    );

    setPrompt("");
    setRunning(true);

    /**
     * This starts as null.
     *
     * We don't create the assistant
     * bubble until the backend actually
     * sends a token.
     */
    let assistantId:
      | string
      | null = null;

    try {
      await streamAgentChat(
        sessionToken,
        {
          message: trimmed,
          threadId,
        },
        (event) => {
          /**
           * Ignore started/progress events.
           *
           * You said you DON'T want:
           *
           * "Thinking..."
           *
           * "Running tool..."
           *
           * inside the chat.
           */
          if (
            event.type ===
            "started"
          ) {
            return;
          }

          if (
            event.type ===
            "progress"
          ) {
            return;
          }

          /**
           * --------------------------------
           * REAL ASSISTANT RESPONSE
           * --------------------------------
           */
          if (
            event.type ===
              "token" &&
            event.token
          ) {
            /**
             * Create the assistant
             * message only now.
             */
            if (!assistantId) {
              assistantId =
                crypto.randomUUID();

              setMessages(
                (current) => [
                  ...current,
                  {
                    id: assistantId!,
                    role: "assistant",
                    content:
                      event.token ?? "",
                  },
                ],
              );

              return;
            }

            /**
             * Append subsequent tokens.
             */
            setMessages(
              (current) =>
                current.map(
                  (message) =>
                    message.id ===
                    assistantId
                      ? {
                          ...message,
                          content:
                            message.content +
                            event.token,
                        }
                      : message,
                ),
            );

            return;
          }

          /**
           * --------------------------------
           * ERROR
           * --------------------------------
           */
          if (
            event.type ===
            "error"
          ) {
            /**
             * If an assistant bubble
             * doesn't exist yet, create
             * one with the actual error.
             */
            if (!assistantId) {
              assistantId =
                crypto.randomUUID();

              setMessages(
                (current) => [
                  ...current,
                  {
                    id: assistantId!,
                    role: "assistant",
                    content:
                      event.message ??
                      "Agent failed.",
                  },
                ],
              );

              return;
            }

            setMessages(
              (current) =>
                current.map(
                  (message) =>
                    message.id ===
                    assistantId
                      ? {
                          ...message,
                          content:
                            event.message ??
                            "Agent failed.",
                        }
                      : message,
                ),
            );
          }
        },
      );

      /**
       * Refresh sidebar so the
       * new thread title appears.
       */
      await refreshThreads();
    } catch (error) {
      console.error(
        "Agent request failed:",
        error,
      );

      /**
       * Only show an error message
       * if the agent never produced
       * an assistant response.
       */
      if (!assistantId) {
        setMessages(
          (current) => [
            ...current,
            {
              id: crypto.randomUUID(),
              role: "system",
              content:
                "Could not reach the agent API.",
            },
          ],
        );
      }
    } finally {
      setRunning(false);
    }
  }

  function onSubmit(
    event: FormEvent,
  ) {
    event.preventDefault();

    sendMessage(prompt);
  }

  function onKeyDown(
    event: KeyboardEvent<HTMLTextAreaElement>,
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      sendMessage(prompt);
    }
  }

  const showEmpty =
    messages.length === 1 &&
    messages[0]?.id === "welcome";

  return (
    <div className={styles.root}>
      {/* -------------------------------- */}
      {/* SIDEBAR */}
      {/* -------------------------------- */}

      <aside
        className={
          styles.aside
        }
      >
        <div
          className={
            styles.brandRow
          }
        >
          <div
            className={
              styles.brandLeft
            }
          >
            <div
              className={
                styles.brandIcon
              }
            >
              <Sparkles
                className={
                  styles.brandIconSvg
                }
              />
            </div>

            <div
              className={
                styles.brandText
              }
            >
              <p
                className={
                  styles.brandTitle
                }
              >
                Meet Agent
              </p>
            </div>
          </div>
        </div>

        <div
          className={
            styles.topActions
          }
        >
          <Button
            onClick={
              startNewChat
            }
            variant="outline"
            className={
              styles.newChatBtn
            }
            disabled={
              running ||
              loadingThread
            }
          >
            <MessageSquarePlus
              className={
                styles.newChatIcon
              }
            />

            New Chat
          </Button>

          {connections}
        </div>

        <Separator
          className={
            styles.separator
          }
        />

        {/* -------------------------------- */}
        {/* CHATS */}
        {/* -------------------------------- */}

        <div
          className={
            styles.chatsSection
          }
        >
          <p
            className={
              styles.chatsTitle
            }
          >
            Chats
          </p>

          <ScrollArea
            className={
              styles.chatsScroll
            }
          >
            {threads.length ===
            0 ? (
              <p
                className={
                  styles.chatsEmpty
                }
              >
                No chats yet. Start
                one and it will show
                up here.
              </p>
            ) : (
              <div
                className={
                  styles.threadList
                }
              >
                {threads.map(
                  (thread) => {
                    const active =
                      thread.id ===
                      threadId;

                    const deleting =
                      deletingThreadId ===
                      thread.id;

                    return (
                      <div
                        key={
                          thread.id
                        }
                        className={
                          styles.threadItem
                        }
                      >
                        {/* CHAT BUTTON */}
                        <button
                          type="button"
                          disabled={
                            running ||
                            loadingThread ||
                            deletingThreadId !==
                              null
                          }
                          onClick={() =>
                            resumeThread(
                              thread.id,
                            )
                          }
                          className={cn(
                            styles.threadBtn,
                            active
                              ? styles.threadBtnActive
                              : styles.threadBtnIdle,
                          )}
                        >
                          <span
                            className={
                              styles.threadTitle
                            }
                          >
                            {thread.title ||
                              "Untitled Chat"}
                          </span>

                          <span
                            className={
                              styles.threadTime
                            }
                          >
                            {thread.updatedAt}
                          </span>
                        </button>

                        {/* DELETE BUTTON */}
                        <button
                          type="button"
                          aria-label={`Delete ${thread.title || "chat"}`}
                          title="Delete chat"
                          disabled={
                            running ||
                            loadingThread ||
                            deletingThreadId !==
                              null
                          }
                          onClick={(
                            event,
                          ) =>
                            handleDeleteThread(
                              event,
                              thread.id,
                              thread.title,
                            )
                          }
                          className={
                            styles.deleteBtn
                          }
                        >
                          {deleting ? (
                            <LoaderCircle
                              className={cn(
                                styles.deleteIcon,
                                "animate-spin",
                              )}
                            />
                          ) : (
                            <Trash2
                              className={
                                styles.deleteIcon
                              }
                            />
                          )}
                        </button>
                      </div>
                    );
                  },
                )}
              </div>
            )}
          </ScrollArea>
        </div>

        <Separator
          className={
            styles.separator
          }
        />

        <div
          className={
            styles.footer
          }
        >
          {footer}
        </div>
      </aside>

      {/* -------------------------------- */}
      {/* MAIN */}
      {/* -------------------------------- */}

      <section
        className={
          styles.main
        }
      >
        <header
          className={
            styles.header
          }
        >
          <div
            className={
              styles.headerText
            }
          >
            <p
              className={
                styles.headerTitle
              }
            >
              Assistant
            </p>

            <p
              className={
                styles.headerSubtitle
              }
            >
              Schedule, reschedule,
              and brief your day
            </p>
          </div>
        </header>

        <div
          className={
            styles.chatColumn
          }
        >
          <ScrollArea
            className={
              styles.messagesScroll
            }
          >
            <div
              className={
                styles.messagesInner
              }
            >
              {showEmpty ? (
                /* -------------------------------- */
                /* EMPTY / WELCOME STATE */
                /* -------------------------------- */
                <div
                  className={
                    styles.emptyState
                  }
                >
                  <div
                    className={
                      styles.emptyIcon
                    }
                  >
                    <Sparkles
                      className={
                        styles.emptyIconSvg
                      }
                    />
                  </div>

                  <h2
                    className={
                      styles.emptyTitle
                    }
                  >
                    Meeting Assistant
                  </h2>

                  <p
                    className={
                      styles.emptyCopy
                    }
                  >
                    {WELCOME}
                  </p>

                  <div
                    className={
                      styles.suggestions
                    }
                  >
                    {SUGGESTIONS.map(
                      (
                        currentSuggestionItem,
                      ) => (
                        <Button
                          key={
                            currentSuggestionItem
                          }
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            sendMessage(
                              currentSuggestionItem,
                            )
                          }
                          className={
                            styles.suggestionBtn
                          }
                          disabled={
                            running ||
                            loadingThread
                          }
                        >
                          {
                            currentSuggestionItem
                          }
                        </Button>
                      ),
                    )}
                  </div>
                </div>
              ) : (
                /* -------------------------------- */
                /* MESSAGE LIST */
                /* -------------------------------- */
                <div
                  className={
                    styles.messageList
                  }
                >
                  {loadingThread ? (
                    <div className="flex items-center justify-center py-10">
                      <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    messages.map(
                      (
                        message,
                      ) => {
                        /**
                         * Don't show welcome
                         * after real messages
                         * exist.
                         */
                        if (
                          message.id ===
                            "welcome" &&
                          messages.length >
                            1
                        ) {
                          return null;
                        }

                        /**
                         * Never render an
                         * empty message.
                         *
                         * This is another
                         * safety layer.
                         */
                        if (
                          !message.content.trim()
                        ) {
                          return null;
                        }

                        return (
                          <div
                            key={
                              message.id
                            }
                            className={cn(
                              styles.messageRow,

                              message.role ===
                                "user"
                                ? styles.messageRowUser
                                : styles.messageRowAssistant,
                            )}
                          >
                            <div
                              className={cn(
                                styles.bubble,

                                message.role ===
                                  "user" &&
                                  styles.bubbleUser,

                                message.role ===
                                  "assistant" &&
                                  styles.bubbleAssistant,

                                message.role ===
                                  "system" &&
                                  styles.bubbleSystem,
                              )}
                            >
                              {message.role ===
                              "user" ? (
                                <p
                                  className={
                                    styles.userText
                                  }
                                >
                                  {
                                    message.content
                                  }
                                </p>
                              ) : (
                                <MarkdownMessage
                                  content={
                                    message.content
                                  }
                                  tone={
                                    message.role ===
                                    "system"
                                      ? "system"
                                      : "assistant"
                                  }
                                />
                              )}
                            </div>
                          </div>
                        );
                      },
                    )
                  )}

                  <div
                    ref={
                      bottomRef
                    }
                  />
                </div>
              )}
            </div>
          </ScrollArea>

          {/* -------------------------------- */}
          {/* COMPOSER */}
          {/* -------------------------------- */}

          <div
            className={
              styles.composerWrap
            }
          >
            <form
              onSubmit={
                onSubmit
              }
              className={
                styles.composerForm
              }
            >
              <textarea
                value={
                  prompt
                }
                onChange={(
                  event: ChangeEvent<HTMLTextAreaElement>,
                ) =>
                  setPrompt(
                    event.target
                      .value,
                  )
                }
                rows={1}
                onKeyDown={
                  onKeyDown
                }
                disabled={
                  running
                }
                placeholder="Ask about your calendar..."
                className={
                  styles.composerInput
                }
              />

              <Button
                type="submit"
                size="icon"
                disabled={
                  !prompt.trim() ||
                  running
                }
                className={
                  styles.sendBtn
                }
                aria-label="Send Text Message"
              >
                {running ? (
                  <LoaderCircle
                    className={
                      styles.sendIconSpin
                    }
                  />
                ) : (
                  <ArrowUp
                    className={
                      styles.sendIcon
                    }
                  />
                )}
              </Button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}

export default ChatPanel;