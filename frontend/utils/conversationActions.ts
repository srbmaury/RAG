import type { Dispatch, SetStateAction, RefObject } from 'react';
import { api } from '../lib/api';
import { conversationPlan } from '../lib/conversation';
import { requestedConnectedSource } from '../lib/query-routing';
import { requestResearchAnswer, persistConversation } from '../lib/researchRequests';
import { isResearchProvider } from '../lib/providers';
import type { User, Source, Message, ChatSummary, SavedChat, ConnectedSourceStatus, ResearchProvider } from '../lib/types';

type Setter<T> = Dispatch<SetStateAction<T>>;

type Options = {
    workspaceId: string;
    query: string;
    busy: boolean;
    hasAskSources: boolean;
    user: User | null;
    sourceStatuses: ConnectedSourceStatus[];
    includeDocuments: boolean;
    connectedGmail: boolean;
    connectedProviders: ResearchProvider[];
    connectedGmailQuery: string;
    selected: string[];
    messages: Message[];
    scope: RefObject<string>;
    askController: RefObject<AbortController | null>;
    activeChat: RefObject<string | null>;
    chatMessages: RefObject<Message[]>;
    chatTitle: RefObject<string>;
    setChatId: (id: string | null) => void;
    setMessages: (messages: Message[]) => void;
    setChats: Setter<ChatSummary[]>;
    setSource: Setter<Source | null>;
    setIncludeDocuments: Setter<boolean>;
    setConnectedGmail: Setter<boolean>;
    setConnectedProviders: Setter<ResearchProvider[]>;
    setQuery: Setter<string>;
    setTab: Setter<'overview' | 'documents' | 'chat' | 'sources'>;
    setError: Setter<string>;
    setNotice: Setter<string>;
    setBusy: Setter<boolean>;
    setAnswerProgress: Setter<string>;
    setCopied: Setter<boolean>;
    navigate: (tab: 'chat') => void;
    newChat: () => void;
};

export function createConversationActions({
    workspaceId,
    query,
    busy,
    hasAskSources,
    user,
    sourceStatuses,
    includeDocuments,
    connectedGmail,
    connectedProviders,
    connectedGmailQuery,
    selected,
    messages,
    scope,
    askController,
    activeChat,
    chatMessages,
    chatTitle,
    setChatId,
    setMessages,
    setChats,
    setSource,
    setIncludeDocuments,
    setConnectedGmail,
    setConnectedProviders,
    setQuery,
    setTab,
    setError,
    setNotice,
    setBusy,
    setAnswerProgress,
    setCopied,
    navigate,
    newChat,
}: Options) {
    async function loadChat(id: string) {
        if (busy) return;
        try {
            const item = await api<SavedChat>(`/workspaces/${workspaceId}/conversations/${id}`);
            if (scope.current !== workspaceId) return;
            const answer = [...item.messages].reverse().find((message) => message.role === 'assistant' && message.result)?.result;
            if (answer?.scope) {
                setIncludeDocuments(answer.scope.includes('documents'));
                setConnectedGmail(answer.scope.includes('gmail'));
                setConnectedProviders(answer.scope.filter(isResearchProvider));
            } else if (answer) {
                const providers = [...new Set(answer.sources.map((source) => source.provider).filter((provider): provider is string => !!provider && provider !== 'documents'))];
                setIncludeDocuments(answer.sources.some((source) => !source.provider || source.provider === 'documents'));
                setConnectedGmail(providers.includes('gmail'));
                setConnectedProviders(providers.filter(isResearchProvider));
            }
            activeChat.current = id;
            setChatId(id);
            chatTitle.current = item.title;
            chatMessages.current = item.messages;
            setMessages(item.messages);
            setSource(null);
            navigate('chat');
        } catch (e) {
            setError((e as Error).message);
        }
    }

    async function renameChat(item: ChatSummary) {
        const name = window.prompt('Conversation name', item.title)?.trim();
        if (!name || name === item.title) return;
        try {
            await api(`/workspaces/${workspaceId}/conversations/${item.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ title: name }),
            });
            setChats((old) => old.map((c) => (c.id === item.id ? { ...c, title: name } : c)));
            if (activeChat.current === item.id) chatTitle.current = name;
        } catch (e) {
            setError((e as Error).message);
        }
    }

    async function deleteChat(item: ChatSummary) {
        if (busy || !window.confirm(`Delete “${item.title}”?`)) return;
        try {
            await api(`/workspaces/${workspaceId}/conversations/${item.id}`, { method: 'DELETE' });
            setChats((old) => old.filter((c) => c.id !== item.id));
            if (activeChat.current === item.id) newChat();
        } catch (e) {
            setError((e as Error).message);
        }
    }

    async function ask(question = query, startNewConversation = false) {
        if (!workspaceId || !question.trim() || busy) return;
        const requestedSource = requestedConnectedSource(question);
        const githubConnected = sourceStatuses.some((source) => source.provider === 'github' && source.connected);
        const calendarQuestion = /\b(calendar|event|events|flight|appointment|meeting|schedule)\b/i.test(question);
        const calendarConnected = sourceStatuses.some((source) => source.provider === 'calendar' && source.connected);
        // Calendar wording can infer a calendar search when only documents are
        // selected, but must not override an explicitly selected connector.
        const calendarOnly = calendarQuestion && calendarConnected && requestedSource !== 'github' && !connectedGmail && connectedProviders.length === 0;
        if (requestedSource === 'github') {
            if (!githubConnected) {
                setError('This question needs GitHub. Connect GitHub in Sources, then ask again.');
                return;
            }
            // A personal PR request is source-specific: do not let similarly worded
            // passages in uploaded documents override connected GitHub records.
            setIncludeDocuments(false);
            setConnectedGmail(false);
            setConnectedProviders(['github']);
        } else if (!calendarOnly) {
            if (!hasAskSources) return;
        } else {
            setIncludeDocuments(false);
            setConnectedGmail(false);
            setConnectedProviders(['calendar']);
        }
        const controller = new AbortController();
        askController.current = controller;
        const target = workspaceId;
        // Home is a new research entry point, never a follow-up to a previously opened chat.
        if (startNewConversation) {
            activeChat.current = null;
            setChatId(null);
            chatTitle.current = 'New chat';
            chatMessages.current = [];
            setMessages([]);
            setSource(null);
        }
        const plan = conversationPlan(startNewConversation ? 'new' : 'followup', activeChat.current, chatMessages.current, question);
        const history = plan.history;
        setQuery('');
        setTab('chat');
        setError('');
        setBusy(true);
        setAnswerProgress('Searching your sources…');
        const title = startNewConversation || chatTitle.current === 'New chat' ? question.trim().slice(0, 100) : chatTitle.current;
        const pending: Message[] = plan.pending;
        chatMessages.current = pending;
        setMessages(pending);
        let id = plan.id;
        try {
            if (!id) {
                const created = await persistConversation(target, null, title, pending);
                id = created.id;
                activeChat.current = id;
                setChatId(id);
                chatTitle.current = title;
                setChats((old) => [{ id: created.id, title, updated: created.updated }, ...old]);
            }
            const scopedProviders: ResearchProvider[] = requestedSource === 'github' ? ['github'] : calendarOnly ? ['calendar'] : connectedProviders;
            const scopedDocuments = requestedSource === 'github' || calendarOnly ? false : includeDocuments;
            const scopedGmail = requestedSource === 'github' || calendarOnly ? false : connectedGmail;
            const useConnected = scopedGmail || scopedProviders.length > 0 || user?.mode === 'ai';
            let draft = '';
            const result = await requestResearchAnswer(
                {
                    workspaceId: target,
                    question,
                    history,
                    documentIds: selected,
                    includeDocuments: scopedDocuments,
                    includeGmail: scopedGmail,
                    gmailQuery: connectedGmailQuery,
                    providers: scopedProviders,
                    useConnected,
                },
                controller.signal,
                setAnswerProgress,
                (delta) => {
                    draft += delta;
                    const live: Message[] = [...pending, { role: 'assistant', content: draft }];
                    chatMessages.current = live;
                    setMessages(live);
                },
            );
            if (scope.current !== target) return;
            const completed: Message[] = [...pending, { role: 'assistant', content: result.answer, result }];
            chatMessages.current = completed;
            setMessages(completed);
            const saved = await persistConversation(target, id, title, completed);
            setChats((old) => [{ id: saved.id, title: saved.title, updated: saved.updated }, ...old.filter((c) => c.id !== saved.id)]);
        } catch (e) {
            if (scope.current === target) {
                const cancelled = (e as Error).name === 'AbortError';
                chatMessages.current = pending;
                setMessages(pending);
                if (cancelled) setNotice('Answer stopped. You can ask the question again when ready.');
                else setError((e as Error).message);
                if (id) {
                    // Preserve the submitted question if generation failed.
                    await api(`/workspaces/${target}/conversations/${id}`, {
                        method: 'PUT',
                        body: JSON.stringify({ title, messages: pending }),
                    }).catch(() => undefined);
                }
            }
        } finally {
            askController.current = null;
            setAnswerProgress('');
            setBusy(false);
        }
    }

    async function refreshChats() {
        const target = workspaceId;
        try {
            const items = await api<ChatSummary[]>(`/workspaces/${target}/conversations`);
            if (scope.current === target) setChats(items);
        } catch (e) {
            setError((e as Error).message);
        }
    }

    async function copyConversation() {
        try {
            await navigator.clipboard.writeText(messages.map((m) => `${m.role === 'user' ? 'You' : 'Atlas'}\n${m.content}`).join('\n\n'));
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            setError('Could not copy the conversation.');
        }
    }
    return { loadChat, renameChat, deleteChat, ask, refreshChats, copyConversation };
}
