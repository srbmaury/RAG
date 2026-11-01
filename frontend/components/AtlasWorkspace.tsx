'use client';
import { ConnectedSourcesView } from './sources/ConnectedSourcesView';
import { WorkspaceSearchDialog } from './layout/WorkspaceSearchDialog';
import { WorkspaceManagementDialog } from './layout/WorkspaceManagementDialog';
import { DocumentScopeDialog } from './documents/DocumentScopeDialog';
import { EvidenceInspector } from './documents/EvidenceInspector';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Check,
  ChevronDown,
  CircleHelp,
  FileText,
  FolderOpen,
  Plus,
  Search,
  Upload,
  X,
  LoaderCircle,
  MessageSquare,
  Moon,
  Sun,
  PanelLeftOpen,
  Menu,
  Copy,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { conversationPlan } from '../lib/conversation';
import { requestedConnectedSource } from '../lib/query-routing';
import { useDocumentImports } from '../hooks/useDocumentImports';
import { useConversation } from '../hooks/useConversation';
import { useAtlasTheme } from '../hooks/useAtlasTheme';
import { useSourceConnections } from '../hooks/useSourceConnections';
import { useGmailWorkspace } from '../hooks/useGmailWorkspace';
import { useConnectedSourcesController } from '../hooks/useConnectedSourcesController';
import { api, apiStream } from '../lib/api';
import type {
  User,
  Workspace,
  Doc,
  DocumentPreview,
  Source,
  Answer,
  Message,
  GmailStatus,
  ChatSummary,
  SavedChat,
} from '../lib/types';
import '../app/rebuild.css';
import { ConversationTranscript } from './chat/ConversationTranscript';
import { ResearchComposer } from './chat/ResearchComposer';
import { ResearchAnswer } from './chat/ResearchAnswer';
import { ConversationHistory } from './chat/ConversationHistory';
import { ResearchSourceSelector } from './chat/ResearchSourceSelector';
import { DocumentsView } from './documents/DocumentsView';
import { DocumentTable } from './documents/DocumentTable';
import { HomeView } from './home/HomeView';
import { AuthView } from './auth/AuthView';
import { WorkspaceSidebar } from './layout/WorkspaceSidebar';
import { AtlasMark, EmptyState } from './ui/WorkspacePrimitives';
import { flushSync } from 'react-dom';

const prettyBytes = (n: number) =>
  n < 1024 * 1024
    ? `${Math.max(1, Math.round(n / 1024))} KB`
    : `${(n / 1024 / 1024).toFixed(1)} MB`;
const prompts = [
  'What are the key takeaways?',
  'What risks should I be aware of?',
  'Compare the main findings across documents',
  'Which decisions still need to be made?',
];

export function AtlasWorkspace() {
  const { theme, toggleTheme } = useAtlasTheme();
  const themeButton = (
    <button
      type="button"
      className="icon-button"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
      onClick={toggleTheme}
    >
      {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
    </button>
  );
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [register, setRegister] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [wid, setWid] = useState('');
  const [docs, setDocs] = useState<Doc[]>([]);
  const [tab, setTab] = useState<'overview' | 'documents' | 'chat' | 'sources'>('chat');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [includeDocuments, setIncludeDocuments] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const { messages, chatId, setMessages, setChatId, activeChat, chatMessages, chatTitle } =
    useConversation();
  const sourceState = useSourceConnections();
  const {
    driveStatus,
    setDriveStatus,
    setDriveResults,
    sourceStatuses,
    setSourceStatuses,
    setSourceChecks,
    setSourceManage,
    setSourceCredential,
    setSourceSearch,
    setSourceResults,
    connectedGmail,
    setConnectedGmail,
    connectedProviders,
    setConnectedProviders,
    connectedGmailQuery,
    setConnectedGmailQuery,
  } = sourceState;
  useEffect(() => {
    setConnectedProviders([]);
    setConnectedGmail(false);
    setIncludeDocuments(true);
    setSourceManage(null);
    setDriveStatus(null);
    setSourceStatuses([]);
    setSourceChecks({});
    setDriveResults([]);
    setSourceResults([]);
    setSourceCredential('');
    setSourceSearch('');
    setQuery('');
    setFilter('');
    setGlobalQuery('');
  }, [wid]);
  const gmailState = useGmailWorkspace();
  const {
    gmailStatus,
    setGmailStatus,
    setGmailMessages,
    setGmailSelected,
    setGmailSummary,
    setGmailSummaryIds,
    setGmailMobileView,
    setGmailPreview,
  } = gmailState;
  const [chats, setChats] = useState<ChatSummary[]>([]);

  const [busy, setBusy] = useState(false);
  const [answerProgress, setAnswerProgress] = useState('');
  const askController = useRef<AbortController | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [source, setSource] = useState<Source | null>(null);
  const [preview, setPreview] = useState<DocumentPreview | null>(null);
  const [dragging, setDragging] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [newWorkspace, setNewWorkspace] = useState(false);
  const [deleteWorkspaceId, setDeleteWorkspaceId] = useState<string | null>(null);
  const [confirmWorkspaceName, setConfirmWorkspaceName] = useState('');
  const [deletingWorkspace, setDeletingWorkspace] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [globalQuery, setGlobalQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  const chatThread = useRef<HTMLDivElement>(null);
  const scope = useRef('');
  scope.current = wid;

  const boot = useCallback(async () => {
    try {
      const actor = await api<User>('/me');
      const list = await api<Workspace[]>('/workspaces');
      setUser(actor);
      setWorkspaces(list);
      setWid(list[0]?.id || '');
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void boot();
  }, [boot]);
  const refresh = useCallback(async () => {
    if (!wid) return;
    const documents = await api<Doc[]>(`/workspaces/${wid}/documents`);
    if (scope.current !== wid) return;
    setDocs(documents);
    setSelected((old) => old.filter((id) => documents.some((d) => d.id === id)));
  }, [wid]);
  const {
    uploading,
    webUrl,
    setWebUrl,
    webBusy,
    uploadProgress,
    uploadSummary,
    setUploadSummary,
    upload,
    importWebPage,
  } = useDocumentImports({
    wid,
    maxFileBytes: user?.max_file_bytes || 0,
    scope,
    input,
    refresh,
    setError,
    setNotice,
  });
  useEffect(() => {
    setDocs([]);
    setMessages([]);
    setChatId(null);
    activeChat.current = null;
    chatMessages.current = [];
    setChats([]);
    setSelected([]);
    setPreview(null);
    setSource(null);
    setError('');
    setNotice('');
    setUploadSummary(null);
    setGmailMessages([]);
    setGmailSelected([]);
    setGmailSummary(null);
    setGmailSummaryIds([]);
    setGmailStatus(null);
    setGmailMobileView('emails');
    setGmailPreview(null);
    if (wid) {
      void api<GmailStatus>(`/gmail/status?wid=${encodeURIComponent(wid)}`)
        .then((status) => {
          if (scope.current === wid) setGmailStatus(status);
        })
        .catch(() => undefined);
      void api<ChatSummary[]>(`/workspaces/${wid}/conversations`)
        .then((list) => {
          if (scope.current === wid) setChats(list);
        })
        .catch((e) => setError(e.message));
    }
    void refresh().catch((e) => setError(e.message));
    const timer = setInterval(() => {
      void refresh().catch((e) => setError(e.message));
    }, 3000);
    return () => clearInterval(timer);
  }, [refresh]);
  useEffect(() => {
    if (tab === 'chat' && messages.length > 0 && chatThread.current)
      chatThread.current.scrollTo({ top: chatThread.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, busy, tab]);

  async function authenticate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/auth/${register ? 'register' : 'login'}`, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      await boot();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function loadChat(id: string) {
    if (busy) return;
    try {
      const item = await api<SavedChat>(`/workspaces/${wid}/conversations/${id}`);
      if (scope.current !== wid) return;
      const answer = [...item.messages]
        .reverse()
        .find((message) => message.role === 'assistant' && message.result)?.result;
      if (answer?.scope) {
        setIncludeDocuments(answer.scope.includes('documents'));
        setConnectedGmail(answer.scope.includes('gmail'));
        setConnectedProviders(
          answer.scope.filter((provider) =>
            ['drive', 'github', 'notion', 'slack'].includes(provider),
          ),
        );
      } else if (answer) {
        const providers = [
          ...new Set(
            answer.sources
              .map((source) => source.provider)
              .filter((provider): provider is string => !!provider && provider !== 'documents'),
          ),
        ];
        setIncludeDocuments(
          answer.sources.some((source) => !source.provider || source.provider === 'documents'),
        );
        setConnectedGmail(providers.includes('gmail'));
        setConnectedProviders(providers.filter((provider) => provider !== 'gmail'));
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
  function newChat() {
    if (busy) return;
    activeChat.current = null;
    setChatId(null);
    chatTitle.current = 'New chat';
    chatMessages.current = [];
    setMessages([]);
    setQuery('');
    setSource(null);
    setIncludeDocuments(true);
    setConnectedGmail(false);
    setConnectedProviders([]);
    navigate('chat');
  }
  async function renameChat(item: ChatSummary) {
    const name = window.prompt('Conversation name', item.title)?.trim();
    if (!name || name === item.title) return;
    try {
      await api(`/workspaces/${wid}/conversations/${item.id}`, {
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
      await api(`/workspaces/${wid}/conversations/${item.id}`, { method: 'DELETE' });
      setChats((old) => old.filter((c) => c.id !== item.id));
      if (activeChat.current === item.id) newChat();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function ask(question = query, startNewConversation = false) {
    if (!wid || !question.trim() || busy) return;
    const requestedSource = requestedConnectedSource(question);
    const githubConnected = sourceStatuses.some(
      (source) => source.provider === 'github' && source.connected,
    );
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
    } else if (!hasAskSources) return;
    const controller = new AbortController();
    askController.current = controller;
    const target = wid;
    // Home is a new research entry point, never a follow-up to a previously opened chat.
    if (startNewConversation) {
      activeChat.current = null;
      setChatId(null);
      chatTitle.current = 'New chat';
      chatMessages.current = [];
      setMessages([]);
      setSource(null);
    }
    const plan = conversationPlan(
      startNewConversation ? 'new' : 'followup',
      activeChat.current,
      chatMessages.current,
      question,
    );
    const history = plan.history;
    setQuery('');
    setTab('chat');
    setError('');
    setBusy(true);
    setAnswerProgress('Searching your sources…');
    const title =
      startNewConversation || chatTitle.current === 'New chat'
        ? question.trim().slice(0, 100)
        : chatTitle.current;
    const pending: Message[] = plan.pending;
    chatMessages.current = pending;
    setMessages(pending);
    let id = plan.id;
    try {
      if (!id) {
        const created = await api<SavedChat>(`/workspaces/${target}/conversations`, {
          method: 'POST',
          body: JSON.stringify({ title, messages: pending }),
        });
        id = created.id;
        activeChat.current = id;
        setChatId(id);
        chatTitle.current = title;
        setChats((old) => [{ id: created.id, title, updated: created.updated }, ...old]);
      }
      const scopedProviders = requestedSource === 'github' ? ['github'] : connectedProviders;
      const scopedDocuments = requestedSource === 'github' ? false : includeDocuments;
      const scopedGmail = requestedSource === 'github' ? false : connectedGmail;
      const useConnected = scopedGmail || scopedProviders.length > 0 || user?.mode === 'ai';
      const answerBody = {
        question,
        history,
        document_ids: selected,
        include_documents: scopedDocuments,
        include_gmail: scopedGmail,
        gmail_query: connectedGmailQuery,
        providers: scopedProviders,
      };
      let result: Answer;
      if (useConnected) {
        let draft = '';
        result = await apiStream<Answer>(
          `/workspaces/${target}/connected-chat/stream`,
          answerBody,
          (event) => {
            if (event.type === 'status') setAnswerProgress(event.text);
            if (event.type === 'delta') {
              draft += event.text;
              const live: Message[] = [...pending, { role: 'assistant', content: draft }];
              chatMessages.current = live;
              setMessages(live);
            }
          },
          controller.signal,
        );
      } else {
        result = await api<Answer>(`/workspaces/${target}/chat`, {
          method: 'POST',
          body: JSON.stringify({ question, history, document_ids: selected }),
          signal: controller.signal,
        });
        result.scope = ['documents'];
      }
      if (scope.current !== target) return;
      const completed: Message[] = [
        ...pending,
        { role: 'assistant', content: result.answer, result },
      ];
      chatMessages.current = completed;
      setMessages(completed);
      const saved = await api<SavedChat>(`/workspaces/${target}/conversations/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ title, messages: completed }),
      });
      setChats((old) => [
        { id: saved.id, title: saved.title, updated: saved.updated },
        ...old.filter((c) => c.id !== saved.id),
      ]);
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
  async function remove(doc: Doc) {
    if (!confirm(`Delete “${doc.name}” and its indexed content?`)) return;
    try {
      await api(`/workspaces/${wid}/documents/${doc.id}`, { method: 'DELETE' });
      setSource(null);
      setPreview(null);
      setUploadSummary(null);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function retry(doc: Doc) {
    try {
      await api(`/workspaces/${wid}/documents/${doc.id}/retry`, { method: 'POST' });
      setSource(null);
      setPreview(null);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function inspect(doc: Doc) {
    try {
      setPreview(await api(`/workspaces/${wid}/documents/${doc.id}/chunks`));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function loadMorePassages() {
    if (!preview) return;
    try {
      const next = await api<DocumentPreview>(
        `/workspaces/${wid}/documents/${preview.document.id}/chunks?offset=${preview.chunks.length}`,
      );
      if (next) setPreview({ ...preview, chunks: [...preview.chunks, ...next.chunks] });
    } catch (error) {
      setError((error as Error).message);
    }
  }
  function navigate(next: typeof tab) {
    flushSync(() => {
      setTab(next);
      setSidebarOpen(false);
    });
  }

  async function addWorkspace(e: React.FormEvent) {
    e.preventDefault();
    try {
      const value = await api<Workspace>('/workspaces', {
        method: 'POST',
        body: JSON.stringify({ name: workspaceName }),
      });
      setWorkspaces((old) => [...old, value]);
      setWid(value.id);
      setNewWorkspace(false);
      setWorkspaceName('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function removeWorkspace() {
    const target = workspaces.find((w) => w.id === deleteWorkspaceId);
    if (!target || target.name !== confirmWorkspaceName || deletingWorkspace || uploading || busy)
      return;
    setDeletingWorkspace(true);
    try {
      await api(`/workspaces/${target.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ name: confirmWorkspaceName }),
      });
      const remaining = workspaces.filter((w) => w.id !== target.id);
      setWorkspaces(remaining);
      if (wid === target.id) setWid(remaining[0]?.id || '');
      setDeleteWorkspaceId(null);
      setConfirmWorkspaceName('');
      setNewWorkspace(false);
      setNotice(`Workspace “${target.name}” deleted.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeletingWorkspace(false);
    }
  }
  async function refreshChats() {
    const target = wid;
    try {
      const items = await api<ChatSummary[]>(`/workspaces/${target}/conversations`);
      if (scope.current === target) setChats(items);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const sourceController = useConnectedSourcesController({
    wid,
    tab,
    scope,
    sourceState,
    gmailState,
    setError,
    setNotice,
  });
  async function signOut() {
    try {
      await api('/auth/logout', { method: 'POST' });
      setUser(null);
      setPassword('');
      setDocs([]);
      setMessages([]);
      setWid('');
      setPreview(null);
      setSource(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    function shortcuts(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setScopeOpen(false);
        setNewWorkspace(false);
        setSourceManage(null);
        setSourceCredential('');
        setGmailPreview(null);
        setSource(null);
        setPreview(null);
        setSidebarOpen(false);
      }
    }
    window.addEventListener('keydown', shortcuts);
    return () => window.removeEventListener('keydown', shortcuts);
  }, []);

  const ready = docs.filter((d) => d.status === 'ready');
  const hasAskSources =
    (includeDocuments && ready.length > 0) || connectedGmail || connectedProviders.length > 0;
  const filtered = docs.filter((d) => d.name.toLowerCase().includes(filter.toLowerCase()));
  const workspace = workspaces.find((w) => w.id === wid);

  const storage = docs.reduce((sum, d) => sum + d.size, 0);
  // Only passages actually cited in the answer count as supporting evidence.
  // Preserve original retrieval indices so [3] always opens source 3.

  const title = messages.find((m) => m.role === 'user')?.content || 'New research';
  const initials = user?.email.slice(0, 2).toUpperCase() || 'A';
  const uploadedDocs = uploadSummary ? docs.filter((d) => uploadSummary.ids.includes(d.id)) : [];
  const uploadStatus = uploadSummary
    ? [
        ...(['queued', 'processing', 'ready', 'failed'] as const).map((status) => {
          const count = uploadedDocs.filter((d) => d.status === status).length;
          return count ? `${count} ${status === 'ready' ? 'ready to search' : status}` : '';
        }),
        uploadSummary.duplicates ? `${uploadSummary.duplicates} duplicates skipped` : '',
        uploadSummary.ids.some((id) => !docs.some((d) => d.id === id))
          ? 'Refreshing document status'
          : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  function renderAnswer(result: Answer) {
    return <ResearchAnswer result={result} onOpenSource={setSource} />;
  }
  async function copyConversation() {
    try {
      await navigator.clipboard.writeText(
        messages.map((m) => `${m.role === 'user' ? 'You' : 'Atlas'}\n${m.content}`).join('\n\n'),
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy the conversation.');
    }
  }
  const uploadButton = (
    <button
      className="btn primary"
      disabled={uploading || !wid}
      onClick={() => input.current?.click()}
    >
      {uploading ? <LoaderCircle className="spin" /> : <Plus />}
      <span>{uploading ? 'Uploading…' : 'Add documents'}</span>
    </button>
  );

  if (loading)
    return (
      <div className="opening">
        <AtlasMark />
        <LoaderCircle className="spin" />
        <span>Opening your research workspace…</span>
      </div>
    );
  if (!user)
    return (
      <AuthView
        themeButton={themeButton}
        register={register}
        email={email}
        password={password}
        error={error}
        busy={busy}
        onSubmit={authenticate}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onToggleMode={() => {
          setRegister(!register);
          setError('');
        }}
      />
    );

  return (
    <div className={`app atlas-v3 ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <input
        ref={input}
        type="file"
        multiple
        accept=".pdf,.docx,.txt,.md,.csv,.json,.html,.htm"
        hidden
        onChange={(e) => {
          if (e.target.files) void upload(e.target.files);
        }}
      />
      {sidebarOpen && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <WorkspaceSidebar
        open={sidebarOpen}
        onCollapse={() => {
          setSidebarCollapsed(true);
          setSidebarOpen(false);
        }}
        onWorkspaceSettings={() => setNewWorkspace(true)}
        workspace={workspace}
        workspaceCount={workspaces.length}
        tab={tab}
        onNavigate={navigate}
        chats={chats}
        onOpenChat={(id) => void loadChat(id)}
        onAllChats={() => {
          navigate('chat');
          setHistoryOpen(true);
          void refreshChats();
        }}
        readyCount={ready.length}
        storageLabel={storage ? prettyBytes(storage) : '0 KB'}
        initials={initials}
        email={user.email}
        onSignOut={() => void signOut()}
      />
      <main className="main">
        <header className="topbar">
          <button
            className="icon-button mobile"
            aria-label="Open menu"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu />
          </button>
          <button
            className="icon-button expand-sidebar"
            aria-label="Expand sidebar"
            onClick={() => setSidebarCollapsed(false)}
          >
            <PanelLeftOpen />
          </button>
          <button className="global-search" onClick={() => setSearchOpen(true)}>
            <Search />
            <span>Search documents or ask a question…</span>
            <kbd className="key">⌘ K</kbd>
          </button>
          <div className="top-actions">
            {themeButton}
            <button
              className="initials"
              aria-label="Manage workspaces"
              onClick={() => setNewWorkspace(true)}
            >
              {initials}
            </button>
          </div>
        </header>
        <div className="content">
          {error && (
            <div className="feedback error" role="alert">
              <AlertCircle />
              <span>{error}</span>
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => setError('')}
              >
                <X />
              </button>
            </div>
          )}
          {notice && (
            <div className="feedback" role="status">
              <CheckCircle2 />
              <span>{notice}</span>
              <button
                className="icon-button"
                aria-label="Dismiss notice"
                onClick={() => setNotice('')}
              >
                <X />
              </button>
            </div>
          )}
          {uploadProgress && (
            <div className="feedback" role="status">
              <LoaderCircle className="spin" />
              <span>{uploadProgress}</span>
            </div>
          )}
          {uploadSummary && (
            <div className="feedback" role="status">
              <Upload />
              <span>
                {uploadStatus || 'No files added'}{' '}
                <button className="text-button" onClick={() => navigate('documents')}>
                  View documents
                </button>
              </span>
              <button
                className="icon-button"
                aria-label="Dismiss upload status"
                onClick={() => setUploadSummary(null)}
              >
                <X />
              </button>
            </div>
          )}
          {!wid && (
            <EmptyState
              icon={<FolderOpen />}
              title="A new space for your knowledge"
              text="Create a workspace to add documents and begin researching."
              action={
                <button className="btn primary" onClick={() => setNewWorkspace(true)}>
                  <Plus />
                  Create workspace
                </button>
              }
            />
          )}
          {wid && tab === 'overview' && (
            <HomeView
              query={query}
              onQueryChange={setQuery}
              onAsk={() => void ask(query, true)}
              hasAskSources={hasAskSources}
              includeDocuments={includeDocuments}
              readyCount={ready.length}
              busy={busy}
              chats={chats}
              docs={docs}
              onOpenSources={() => navigate('sources')}
              onOpenConversations={() => {
                navigate('chat');
                setHistoryOpen(true);
                void refreshChats();
              }}
              onOpenConversation={(id) => void loadChat(id)}
              onStartChat={() => {
                newChat();
                navigate('chat');
              }}
              onOpenDocuments={() => navigate('documents')}
              onInspectDocument={(d) => void inspect(d)}
              uploadButton={uploadButton}
              dragging={dragging}
              onDragging={setDragging}
              onDrop={(files) => void upload(files)}
              maxSizeMB={Math.round(user.max_file_bytes / 1024 / 1024)}
              uploading={uploading}
              onBrowse={() => input.current?.click()}
              formatSize={prettyBytes}
            />
          )}
          {wid && tab === 'chat' && (
            <section>
              <div className="crumb">
                Ask Atlas<span>›</span>
                <span className="crumb-title">{title}</span>
              </div>
              <div className="heading-row">
                <div className="research-heading">
                  <span className="eyebrow">RESEARCH ASSISTANT</span>
                  <h1 title={title}>{title}</h1>
                  <p className="subtitle">
                    Answers grounded in your documents, with evidence you can inspect.
                  </p>
                </div>
                <div className="actions">
                  <button className="btn" onClick={() => setHistoryOpen((v) => !v)}>
                    <MessageSquare size={15} />
                    {historyOpen ? 'Hide history' : 'History'}
                  </button>
                  <button
                    className="btn hide-small"
                    disabled={!messages.length}
                    onClick={() => void copyConversation()}
                  >
                    {copied ? <Check /> : <Copy />}
                    {copied ? 'Copied' : 'Copy chat'}
                  </button>
                  <button className="btn primary" disabled={busy} onClick={newChat}>
                    <Plus />
                    <span>New chat</span>
                  </button>
                </div>
              </div>
              <div className="filters">
                <button className="filter" onClick={() => setScopeOpen(true)}>
                  <FileText />
                  {selected.length ? `${selected.length} selected documents` : 'All documents'}
                  <ChevronDown />
                </button>
                <span className="research-mode">
                  <i />
                  {user.mode === 'ai' ? 'AI research' : 'Source search'} · {ready.length} ready
                  documents
                </span>
              </div>
              <ResearchSourceSelector
                includeDocuments={includeDocuments}
                onIncludeDocuments={setIncludeDocuments}
                gmailStatus={gmailStatus}
                connectedGmail={connectedGmail}
                onIncludeGmail={setConnectedGmail}
                driveStatus={driveStatus}
                sourceStatuses={sourceStatuses}
                connectedProviders={connectedProviders}
                onToggleProvider={(provider, enabled) =>
                  setConnectedProviders((old) =>
                    enabled ? [...old, provider] : old.filter((x) => x !== provider),
                  )
                }
                onManage={() => navigate('sources')}
              />
              {connectedGmail && (
                <div className="unified-gmail-scope">
                  <label>
                    Gmail search scope{' '}
                    <input
                      aria-label="Gmail search scope"
                      value={connectedGmailQuery}
                      onChange={(e) => setConnectedGmailQuery(e.target.value)}
                    />
                  </label>
                </div>
              )}

              {user.mode !== 'ai' && (
                <div className="feedback" role="status">
                  <CircleHelp />
                  <span>
                    <strong>Source search only.</strong> Atlas can find relevant passages, but it
                    cannot write synthesized answers until an AI provider is configured. Set{' '}
                    <code>AI_PROVIDER=openai</code> with <code>OPENAI_API_KEY</code>, or use{' '}
                    <code>AI_PROVIDER=ollama</code>, then restart the API.
                  </span>
                </div>
              )}
              <div className={`chat-workspace ${historyOpen ? 'history-visible' : ''}`}>
                <ConversationHistory
                  chats={chats}
                  chatId={chatId}
                  busy={busy}
                  onRefresh={() => void refreshChats()}
                  onNewChat={newChat}
                  onOpenChat={(id) => void loadChat(id)}
                  onRenameChat={(item) => void renameChat(item)}
                  onDeleteChat={(item) => void deleteChat(item)}
                />
                <div className="research">
                  <div className="chat-pane">
                    <ConversationTranscript
                      messages={messages}
                      busy={busy}
                      readyCount={ready.length}
                      uploadButton={uploadButton}
                      prompts={prompts}
                      onPrompt={(p) => void ask(p)}
                      initials={initials}
                      renderAnswer={renderAnswer}
                      answerProgress={answerProgress}
                      onStop={() => askController.current?.abort()}
                      threadRef={chatThread}
                      endRef={chatEnd}
                    />
                    {messages.length > 0 && (
                      <div className="prompt-row">
                        {[
                          'What are the key risks?',
                          'What should be built first?',
                          'Summarize the next steps',
                        ].map((p) => (
                          <button
                            key={p}
                            disabled={busy || !hasAskSources}
                            onClick={() => void ask(p)}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    )}
                    <ResearchComposer
                      query={query}
                      onChange={setQuery}
                      onSubmit={() => void ask()}
                      onUpload={() => input.current?.click()}
                      uploading={uploading}
                      busy={busy}
                      hasAskSources={hasAskSources}
                      hasMessages={messages.length > 0}
                    />
                    <p id="research-composer-help" className="caption composer-caption">
                      {messages.length ? 'Follow-ups use this conversation’s context. ' : ''}Review
                      supporting passages before relying on an answer.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}
          {wid && tab === 'documents' && (
            <DocumentsView
              uploadButton={uploadButton}
              webImport={
                <form
                  onSubmit={(e) => void importWebPage(e)}
                  style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    margin: '18px 0',
                  }}
                >
                  <label htmlFor="atlas-web-url">Save public web page</label>
                  <input
                    id="atlas-web-url"
                    type="url"
                    required
                    value={webUrl}
                    onChange={(e) => setWebUrl(e.target.value)}
                    placeholder="https://example.com/article"
                    style={{
                      minWidth: 260,
                      flex: 1,
                      padding: 10,
                      borderRadius: 8,
                      border: '1px solid var(--border, #999)',
                    }}
                  />
                  <button className="btn" type="submit" disabled={webBusy}>
                    {webBusy ? 'Importing…' : 'Add URL'}
                  </button>
                </form>
              }
              totalDocuments={docs.length}
              readyDocuments={ready.length}
              storageLabel={storage ? prettyBytes(storage) : '0 KB'}
              filteredCount={filtered.length}
              filter={filter}
              onFilter={setFilter}
              documentTable={
                <DocumentTable
                  items={filtered}
                  filter={filter}
                  onClearFilter={() => setFilter('')}
                  uploadButton={uploadButton}
                  onInspect={(d) => void inspect(d)}
                  onRetry={(d) => void retry(d)}
                  onRemove={(d) => void remove(d)}
                  downloadUrl={(d) => `/api/workspaces/${wid}/documents/${d.id}/original`}
                  formatSize={prettyBytes}
                />
              }
              dragging={dragging}
              onDragging={setDragging}
              onDrop={(files) => void upload(files)}
              maxSizeMB={Math.round(user.max_file_bytes / 1024 / 1024)}
              uploading={uploading}
              onBrowse={() => input.current?.click()}
            />
          )}
          {wid && tab === 'sources' && (
            <ConnectedSourcesView
              sourceState={sourceState}
              gmailState={gmailState}
              controller={sourceController}
              setNotice={setNotice}
              setError={setError}
            />
          )}
        </div>
      </main>
      {searchOpen && (
        <WorkspaceSearchDialog
          docs={docs}
          globalQuery={globalQuery}
          setGlobalQuery={setGlobalQuery}
          busy={busy}
          hasAskSources={hasAskSources}
          onClose={() => setSearchOpen(false)}
          onAsk={(question) => void ask(question, true)}
          onInspect={(doc) => void inspect(doc)}
          formatSize={prettyBytes}
        />
      )}
      {scopeOpen && (
        <DocumentScopeDialog
          ready={ready}
          selected={selected}
          setSelected={setSelected}
          onClose={() => setScopeOpen(false)}
        />
      )}
      {newWorkspace && (
        <WorkspaceManagementDialog
          workspaces={workspaces}
          wid={wid}
          setWid={setWid}
          busy={busy}
          uploading={uploading}
          deletingWorkspace={deletingWorkspace}
          deleteWorkspaceId={deleteWorkspaceId}
          setDeleteWorkspaceId={setDeleteWorkspaceId}
          confirmWorkspaceName={confirmWorkspaceName}
          setConfirmWorkspaceName={setConfirmWorkspaceName}
          workspaceName={workspaceName}
          setWorkspaceName={setWorkspaceName}
          setNewWorkspace={setNewWorkspace}
          addWorkspace={addWorkspace}
          removeWorkspace={() => void removeWorkspace()}
        />
      )}
      {(source || preview) && (
        <EvidenceInspector
          source={source}
          preview={preview}
          downloadUrl={`/api/workspaces/${wid}/documents/${source?.document_id || preview?.document.id}/original`}
          onClose={() => {
            setSource(null);
            setPreview(null);
          }}
          onLoadMore={() => void loadMorePassages()}
        />
      )}
    </div>
  );
}
