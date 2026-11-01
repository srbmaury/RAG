'use client';
import { bootWorkspace, refreshWorkspaceMetadata, createSessionActions } from '../utils/sessionActions';
import { refreshDocuments, createDocumentActions } from '../utils/documentActions';
import { createConversationActions } from '../utils/conversationActions';
import { IntegrationsGallery } from './sources/IntegrationsGallery';
import { SourceConnectionDialog } from './sources/SourceConnectionDialog';
import { GmailWorkspaceView } from './sources/gmail/GmailWorkspaceView';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
    Check,
    ChevronDown,
    CircleHelp,
    FileText,
    FolderOpen,
    Layers3,
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

import type { User, Workspace, Doc, Source, Answer, ChatSummary, DocumentPreview } from '../lib/types';

import { useConversation } from '../hooks/useConversation';
import { useAtlasTheme } from '../hooks/useAtlasTheme';
import { useSourceConnections } from '../hooks/useSourceConnections';
import { useGmailWorkspace } from '../hooks/useGmailWorkspace';
import { useConnectedSourcesController } from '../hooks/useConnectedSourcesController';

import '../app/rebuild.css';
import { ConversationTranscript } from './chat/ConversationTranscript';
import { ResearchComposer } from './chat/ResearchComposer';
import { ResearchAnswer } from './chat/ResearchAnswer';
import { EvidenceInspector } from './chat/EvidenceInspector';
import { ConversationHistory } from './chat/ConversationHistory';
import { ResearchSourceSelector } from './chat/ResearchSourceSelector';

import { WorkspaceSearchDialog } from './layout/WorkspaceSearchDialog';
import { WorkspaceManagerDialog } from './layout/WorkspaceManagerDialog';
import { WorkspaceSidebar } from './layout/WorkspaceSidebar';

import { WebPageImportForm } from './documents/WebPageImportForm';
import { DocumentsView } from './documents/DocumentsView';
import { DocumentTable } from './documents/DocumentTable';

import { HomeView } from './home/HomeView';
import { AuthView } from './auth/AuthView';

import { AtlasMark, FileBadge, EmptyState, Dialog } from './ui/WorkspacePrimitives';
import { flushSync } from 'react-dom';

import { prettyBytes, prompts } from '../utils/utils';

export function AtlasWorkspace() {
    const { theme, toggleTheme } = useAtlasTheme();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [register, setRegister] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [workspaceId, setWorkspaceId] = useState('');
    const [docs, setDocs] = useState<Doc[]>([]);
    const [tab, setTab] = useState<'overview' | 'documents' | 'chat' | 'sources'>('chat');
    const [historyOpen, setHistoryOpen] = useState(false);
    const [selected, setSelected] = useState<string[]>([]);
    const [includeDocuments, setIncludeDocuments] = useState(true);
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('');
    const { messages, chatId, setMessages, setChatId, activeChat, chatMessages, chatTitle } = useConversation();
    const sourceState = useSourceConnections();
    const gmailState = useGmailWorkspace();

    const {
        driveStatus,
        setDriveStatus,
        setDriveResults,
        sourceStatuses,
        setSourceStatuses,
        sourceChecks,
        setSourceChecks,
        sourceChecksBusy,
        sourceManage,
        setSourceManage,
        setSourceProvider,
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
    }, [workspaceId]);

    const { gmailStatus, setGmailStatus, setGmailMessages, setGmailSelected, setGmailSummary, setGmailSummaryIds, setGmailMobileView, setGmailPreview } = gmailState;

    const [chats, setChats] = useState<ChatSummary[]>([]);
    const [busy, setBusy] = useState(false);
    const [answerProgress, setAnswerProgress] = useState('');
    const askController = useRef<AbortController | null>(null);
    const [uploading, setUploading] = useState(false);
    const [webUrl, setWebUrl] = useState('');
    const [webBusy, setWebBusy] = useState(false);
    const [uploadProgress, setUploadProgress] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [uploadSummary, setUploadSummary] = useState<{ ids: string[]; duplicates: number } | null>(null);
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
    scope.current = workspaceId;

    const themeButton = (
        <button type="button" className="icon-button" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`} onClick={toggleTheme}>
            {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
        </button>
    );

    const boot = useCallback(() => bootWorkspace({ setUser, setWorkspaces, setWorkspaceId, setLoading }), []);

    useEffect(() => {
        void boot();
    }, [boot]);
    const refresh = useCallback(() => refreshDocuments({ workspaceId, scope, setDocs, setSelected }), [workspaceId]);
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
        void refreshWorkspaceMetadata({ workspaceId, scope, setGmailStatus, setChats, setError });
        void refresh().catch((e) => setError(e.message));
        const timer = setInterval(() => {
            void refresh().catch((e) => setError(e.message));
        }, 3000);
        return () => clearInterval(timer);
    }, [refresh]);
    useEffect(() => {
        if (tab === 'chat' && messages.length > 0 && chatThread.current) chatThread.current.scrollTo({ top: chatThread.current.scrollHeight, behavior: 'smooth' });
    }, [messages.length, busy, tab]);

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

    function navigate(next: typeof tab) {
        flushSync(() => {
            setTab(next);
            setSidebarOpen(false);
        });
    }

    const {
        connectGmail,
        connectDrive,
        disconnectDrive,
        searchDrive,
        refreshConnections,
        verifySourceConnections,
        connectSource,
        connectOAuthSource,
        disconnectSource,
        searchSource,
        searchGmail,
        summarizeGmailQuery,
        summarizeGmail,
        disconnectGmail,
    } = useConnectedSourcesController({
        wid: workspaceId,
        tab,
        scope,
        sourceState,
        gmailState,
        setError,
        setNotice,
    });

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
    const hasAskSources = (includeDocuments && ready.length > 0) || connectedGmail || connectedProviders.length > 0;
    const filtered = docs.filter((d) => d.name.toLowerCase().includes(filter.toLowerCase()));
    const workspace = workspaces.find((w) => w.id === workspaceId);

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
              uploadSummary.ids.some((id) => !docs.some((d) => d.id === id)) ? 'Refreshing document status' : '',
          ]
              .filter(Boolean)
              .join(' · ')
        : '';

    function renderAnswer(result: Answer) {
        return <ResearchAnswer result={result} onOpenSource={setSource} />;
    }

    const { authenticate, addWorkspace, removeWorkspace, signOut } = createSessionActions({
        register,
        email,
        password,
        workspaceId,
        workspaceName,
        workspaces,
        deleteWorkspaceId,
        confirmWorkspaceName,
        deletingWorkspace,
        uploading,
        busy,
        boot,
        setUser,
        setWorkspaces,
        setWorkspaceId,
        setBusy,
        setError,
        setNotice,
        setPassword,
        setDocs,
        setMessages,
        setPreview,
        setSource,
        setNewWorkspace,
        setWorkspaceName,
        setDeletingWorkspace,
        setDeleteWorkspaceId,
        setConfirmWorkspaceName,
    });
    const { importWebPage, upload, remove, retry, inspect } = createDocumentActions({
        workspaceId,
        webUrl,
        webBusy,
        uploading,
        user,
        scope,
        input,
        refresh,
        setWebBusy,
        setWebUrl,
        setError,
        setNotice,
        setUploading,
        setUploadProgress,
        setUploadSummary,
        setSource,
        setPreview,
    });
    const { loadChat, renameChat, deleteChat, ask, refreshChats, copyConversation } = createConversationActions({
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
    });

    const uploadButton = (
        <button className="btn primary" disabled={uploading || !workspaceId} onClick={() => input.current?.click()}>
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
            {sidebarOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
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
                    <button className="icon-button mobile" aria-label="Open menu" onClick={() => setSidebarOpen(true)}>
                        <Menu />
                    </button>
                    <button className="icon-button expand-sidebar" aria-label="Expand sidebar" onClick={() => setSidebarCollapsed(false)}>
                        <PanelLeftOpen />
                    </button>
                    <button className="global-search" onClick={() => setSearchOpen(true)}>
                        <Search />
                        <span>Search documents or ask a question…</span>
                        <kbd className="key">⌘ K</kbd>
                    </button>
                    <div className="top-actions">
                        {themeButton}
                        <button className="initials" aria-label="Manage workspaces" onClick={() => setNewWorkspace(true)}>
                            {initials}
                        </button>
                    </div>
                </header>
                <div className="content">
                    {error && (
                        <div className="feedback error" role="alert">
                            <AlertCircle />
                            <span>{error}</span>
                            <button className="icon-button" aria-label="Dismiss error" onClick={() => setError('')}>
                                <X />
                            </button>
                        </div>
                    )}
                    {notice && (
                        <div className="feedback" role="status">
                            <CheckCircle2 />
                            <span>{notice}</span>
                            <button className="icon-button" aria-label="Dismiss notice" onClick={() => setNotice('')}>
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
                            <button className="icon-button" aria-label="Dismiss upload status" onClick={() => setUploadSummary(null)}>
                                <X />
                            </button>
                        </div>
                    )}
                    {!workspaceId && (
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
                    {workspaceId && tab === 'overview' && (
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
                    {workspaceId && tab === 'chat' && (
                        <section>
                            <div className="crumb">
                                Ask Atlas<span>›</span>
                                <span className="crumb-title">{title}</span>
                            </div>
                            <div className="heading-row">
                                <div className="research-heading">
                                    <span className="eyebrow">RESEARCH ASSISTANT</span>
                                    <h1 title={title}>{title}</h1>
                                    <p className="subtitle">Answers grounded in your documents, with evidence you can inspect.</p>
                                </div>
                                <div className="actions">
                                    <button className="btn" onClick={() => setHistoryOpen((v) => !v)}>
                                        <MessageSquare size={15} />
                                        {historyOpen ? 'Hide history' : 'History'}
                                    </button>
                                    <button className="btn hide-small" disabled={!messages.length} onClick={() => void copyConversation()}>
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
                                    {user.mode === 'ai' ? 'AI research' : 'Source search'} · {ready.length} ready documents
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
                                onToggleProvider={(provider, enabled) => setConnectedProviders((old) => (enabled ? [...old, provider] : old.filter((x) => x !== provider)))}
                                onManage={() => navigate('sources')}
                            />
                            {connectedGmail && (
                                <div className="unified-gmail-scope">
                                    <label>
                                        Gmail search scope <input aria-label="Gmail search scope" value={connectedGmailQuery} onChange={(e) => setConnectedGmailQuery(e.target.value)} />
                                    </label>
                                </div>
                            )}

                            {user.mode !== 'ai' && (
                                <div className="feedback" role="status">
                                    <CircleHelp />
                                    <span>
                                        <strong>Source search only.</strong> Atlas can find relevant passages, but it cannot write synthesized answers until an AI provider is configured. Set{' '}
                                        <code>AI_PROVIDER=openai</code> with <code>OPENAI_API_KEY</code>, or use <code>AI_PROVIDER=ollama</code>, then restart the API.
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
                                                {['What are the key risks?', 'What should be built first?', 'Summarize the next steps'].map((p) => (
                                                    <button key={p} disabled={busy || !hasAskSources} onClick={() => void ask(p)}>
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
                                            {messages.length ? 'Follow-ups use this conversation’s context. ' : ''}Review supporting passages before relying on an answer.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}
                    {workspaceId && tab === 'documents' && (
                        <DocumentsView
                            uploadButton={uploadButton}
                            webImport={<WebPageImportForm url={webUrl} busy={webBusy} onUrlChange={setWebUrl} onSubmit={(event) => void importWebPage(event)} />}
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
                                    downloadUrl={(d) => `/api/workspaces/${workspaceId}/documents/${d.id}/original`}
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
                    {workspaceId && tab === 'sources' && (
                        <section className="connected-page">
                            {sourceManage !== 'gmail' && (
                                <div className="sources-overview">
                                    <div className="crumb">
                                        Workspace<span>›</span>Sources
                                    </div>
                                    <div className="heading-row">
                                        <div>
                                            <span className="eyebrow">YOUR INTEGRATIONS</span>
                                            <h1>Connected sources</h1>
                                            <p className="subtitle">Connect external services to your research workspace. Access stays read-only.</p>
                                        </div>
                                        <div className="source-header-actions">
                                            <button className="btn" onClick={() => void refreshConnections()}>
                                                Refresh list
                                            </button>
                                            <button className="btn primary" disabled={sourceChecksBusy} onClick={() => void verifySourceConnections()}>
                                                {sourceChecksBusy ? (
                                                    <>
                                                        <LoaderCircle className="spin" />
                                                        Checking access…
                                                    </>
                                                ) : (
                                                    'Check source access'
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                    <IntegrationsGallery
                                        gmailStatus={gmailStatus}
                                        driveStatus={driveStatus}
                                        sourceStatuses={sourceStatuses}
                                        sourceChecks={sourceChecks}
                                        onOpen={(provider) => {
                                            setSourceManage(provider);
                                            if (provider === 'gmail') window.scrollTo({ top: 0, behavior: 'instant' });
                                            if (['github', 'notion', 'slack', 'calendar', 'linear', 'jira', 'onedrive', 'outlook', 'sharepoint'].includes(provider)) {
                                                setSourceProvider(provider as 'github' | 'notion' | 'slack' | 'calendar' | 'linear' | 'jira' | 'onedrive' | 'outlook' | 'sharepoint');
                                                setSourceResults([]);
                                            }
                                        }}
                                    />
                                </div>
                            )}
                            {sourceManage === 'gmail' && (
                                <GmailWorkspaceView
                                    state={gmailState}
                                    onBack={() => {
                                        setSourceManage(null);
                                        window.scrollTo({ top: 0, behavior: 'instant' });
                                    }}
                                    onDisconnect={() => void disconnectGmail()}
                                    onConnect={() => void connectGmail()}
                                    onSearch={() => void searchGmail()}
                                    onSummarizeQuery={() => void summarizeGmailQuery()}
                                    onSummarizeSelected={() => void summarizeGmail()}
                                    onNotice={setNotice}
                                    onError={setError}
                                />
                            )}
                            <SourceConnectionDialog
                                state={sourceState}
                                onClose={() => {
                                    setSourceManage(null);
                                    setSourceCredential('');
                                }}
                                onSearchDrive={() => void searchDrive()}
                                onDisconnectDrive={() => void disconnectDrive()}
                                onConnectDrive={() => void connectDrive()}
                                onConnectSource={() => void connectSource()}
                                onConnectOAuthSource={() => void connectOAuthSource()}
                                onSearchSource={() => void searchSource()}
                                onDisconnectSource={(provider) => void disconnectSource(provider)}
                            />
                            <p className="caption">All connections are scoped to this workspace. Source content is accessed on demand; you can disconnect accounts at any time.</p>
                        </section>
                    )}
                </div>
            </main>
            {searchOpen && (
                <WorkspaceSearchDialog
                    query={globalQuery}
                    onQueryChange={setGlobalQuery}
                    onClose={() => setSearchOpen(false)}
                    onAsk={(question) => {
                        setSearchOpen(false);
                        void ask(question, true);
                        setGlobalQuery('');
                    }}
                    onInspect={(doc) => {
                        setSearchOpen(false);
                        void inspect(doc);
                    }}
                    documents={docs}
                    canAsk={!busy && hasAskSources}
                />
            )}
            {scopeOpen && (
                <Dialog title="Choose your sources" onClose={() => setScopeOpen(false)}>
                    <p className="dialog-intro">Ask across all ready documents, or choose a focused set.</p>
                    <button className="btn" onClick={() => setSelected([])}>
                        <Layers3 />
                        Use all documents
                    </button>
                    <div className="scope-list">
                        {ready.map((d) => (
                            <label key={d.id}>
                                <input
                                    type="checkbox"
                                    checked={selected.includes(d.id)}
                                    onChange={(e) => setSelected((old) => (e.target.checked ? [...old, d.id] : old.filter((id) => id !== d.id)))}
                                />
                                <FileBadge name={d.name} />
                                <span>{d.name}</span>
                            </label>
                        ))}
                    </div>
                    <div className="dialog-footer">
                        <span className="caption">{selected.length ? `${selected.length} selected` : 'All ready documents included'}</span>
                        <button className="btn primary" onClick={() => setScopeOpen(false)}>
                            Done
                            <Check />
                        </button>
                    </div>
                </Dialog>
            )}
            {newWorkspace && (
                <WorkspaceManagerDialog
                    workspaces={workspaces}
                    activeId={workspaceId}
                    busy={busy}
                    uploading={uploading}
                    deleting={deletingWorkspace}
                    deleteId={deleteWorkspaceId}
                    confirmation={confirmWorkspaceName}
                    name={workspaceName}
                    onClose={() => {
                        setNewWorkspace(false);
                        setDeleteWorkspaceId(null);
                    }}
                    onSelect={(id) => {
                        setWorkspaceId(id);
                        setNewWorkspace(false);
                    }}
                    onSelectDelete={(id) => {
                        setDeleteWorkspaceId(id);
                        setConfirmWorkspaceName('');
                    }}
                    onConfirmation={setConfirmWorkspaceName}
                    onCancelDelete={() => setDeleteWorkspaceId(null)}
                    onDelete={() => void removeWorkspace()}
                    onName={setWorkspaceName}
                    onCreate={addWorkspace}
                />
            )}
            <EvidenceInspector
                wid={workspaceId}
                source={source}
                preview={preview}
                onClose={() => {
                    setSource(null);
                    setPreview(null);
                }}
                onPreviewChange={setPreview}
                onError={setError}
            />
        </div>
    );
}
