'use client';

import {Children, useEffect, useRef, useState, useCallback, type ReactNode} from 'react';
import {ArrowUp, ArrowUpRight, BookOpen, Check, ChevronDown, ChevronRight, CircleHelp, FileText, FolderOpen, Layers3, LogOut, Plus, Search, ShieldCheck, Sparkles, Trash2, Upload, X, LoaderCircle, RotateCcw, Download, MessageSquare, Lightbulb, Clock3, Moon, Sun, Home as HomeIcon, PanelLeftClose, PanelLeftOpen, Menu, Copy, SlidersHorizontal, CheckCircle2, AlertCircle, NotebookPen, ArrowDownToLine} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import {flushSync} from 'react-dom';
import remarkGfm from 'remark-gfm';

type User = {id: string; email: string; mode: string; max_file_bytes: number};
type Workspace = {id: string; name: string};
type Doc = {id: string; name: string; size: number; status: string; error?: string; pages: number; chunk_count: number};
type Source = {chunk_id: string; document_id: string; name: string; page: number; text: string; location_type: string};
type Answer = {answer: string; sources: Source[]; mode: string; citation_note?: string};
type Message = {role: 'user' | 'assistant'; content: string; result?: Answer};
type ChatSummary = {id: string; title: string; updated: number};
type SavedChat = ChatSummary & {messages: Message[]};
type Analysis = {id: string; kind: string; status: string; error?: string; result?: {mode: string; coverage: {total: number; analyzed: number; excluded: {name: string; status: string}[]}; documents: {document_id: string; name: string; batches: Answer[]}[]; note: string}};

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {...options, headers: options?.body instanceof FormData ? options.headers : {'Content-Type': 'application/json', ...options?.headers}});
  if (!response.ok) {
    const value = await response.json().catch(() => ({}));
    throw new Error(typeof value.detail === 'string' ? value.detail : 'The request could not be completed. Please try again.');
  }
  return response.json();
}
const prettyBytes = (n: number) => n < 1024*1024 ? `${Math.max(1, Math.round(n/1024))} KB` : `${(n/1024/1024).toFixed(1)} MB`;
const prompts = ['What are the key takeaways?', 'What risks should I be aware of?', 'Compare the main findings across documents', 'Which decisions still need to be made?'];

function DocumentPassage({text, name}: {text: string; name: string}) {
  if (/\.(md|docx)$/i.test(name)) {
    return <div className="document-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown></div>;
  }
  return <div className="document-plain">{text}</div>;
}

export default function Home() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    const saved = localStorage.getItem('atlas-theme');
    const initial = saved === 'dark' || (saved !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    setTheme(initial); document.documentElement.dataset.theme = initial;
  }, []);
  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next); document.documentElement.dataset.theme = next; localStorage.setItem('atlas-theme', next);
  }
  const themeButton = <button type="button" className="icon-button" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`} onClick={toggleTheme}>{theme === 'light' ? <Moon size={17}/> : <Sun size={17}/>}</button>;
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [register, setRegister] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [wid, setWid] = useState('');
  const [docs, setDocs] = useState<Doc[]>([]);
  const [startingInsight, setStartingInsight] = useState('');
  const [openingReport, setOpeningReport] = useState('');
  const [openReports, setOpenReports] = useState<string[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [tab, setTab] = useState<'overview' | 'documents' | 'chat'>('chat');
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const activeChat = useRef<string | null>(null);
  const chatMessages = useRef<Message[]>([]);
  const chatTitle = useRef('New chat');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [uploadSummary, setUploadSummary] = useState<{ids: string[]; duplicates: number} | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [preview, setPreview] = useState<{document: Doc; chunks: {id: string; page: number; text: string}[]} | null>(null);
  const [dragging, setDragging] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [newWorkspace, setNewWorkspace] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [evidenceTab, setEvidenceTab] = useState<'sources' | 'notes' | 'related'>('sources');
  const [scopeOpen, setScopeOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [globalQuery, setGlobalQuery] = useState('');
  const [notes, setNotes] = useState('');
  const [copied, setCopied] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  const scope = useRef('');
  scope.current = wid;
  activeChat.current = chatId;
  chatMessages.current = messages;

  const boot = useCallback(async () => {
    try {
      const actor = await api<User>('/me');
      const list = await api<Workspace[]>('/workspaces');
      setUser(actor); setWorkspaces(list); setWid(list[0]?.id || '');
    } catch { setUser(null); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {void boot();}, [boot]);
  const refresh = useCallback(async () => {
    if (!wid) return;
    const documents = await api<Doc[]>(`/workspaces/${wid}/documents`);
    if (scope.current !== wid) return;
    setDocs(documents);
    setSelected(old => old.filter(id => documents.some(d => d.id === id)));
  }, [wid]);
  useEffect(() => {
    setNotes(''); setDocs([]); setAnalyses([]); setOpenReports([]); setMessages([]); setChatId(null); activeChat.current=null; chatMessages.current=[]; setChats([]); setSelected([]); setPreview(null); setSource(null); setError(''); setNotice(''); setUploadSummary(null);
    if (wid) {
      void api<ChatSummary[]>(`/workspaces/${wid}/conversations`).then(list => {if(scope.current===wid) setChats(list);}).catch(e=>setError(e.message));
    }
    void refresh().catch(e => setError(e.message));
    const timer = setInterval(() => {void refresh().catch(e => setError(e.message));}, 3000);
    return () => clearInterval(timer);
  }, [refresh]);
  useEffect(() => {chatEnd.current?.scrollIntoView({behavior: 'smooth'});}, [messages, busy]);

  async function authenticate(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {await api(`/auth/${register ? 'register' : 'login'}`, {method: 'POST', body: JSON.stringify({email, password})}); await boot();}
    catch (e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  async function upload(files: FileList | File[]) {
    if (!files.length || uploading) return;
    const target = wid;
    setUploading(true); setError(''); setNotice(''); setUploadSummary(null);
    const added: string[] = [];
    let duplicates = 0;
    const problems: string[] = [];
    const list = Array.from(files);
    try {
      for (let index = 0; index < list.length; index++) {
        if (scope.current !== target) break;
        const file = list[index];
        let staged: string | null = null;
        try {
          if (file.size > user!.max_file_bytes) throw new Error(`Exceeds the ${Math.round(user!.max_file_bytes / 1024 / 1024)} MB file limit.`);
          setUploadProgress(`Uploading ${index + 1} of ${list.length}: ${file.name} · 0%`);
          let documents: (Doc & {duplicate?: boolean})[];
          if (file.size > 8 * 1024 * 1024) {
            const job = await api<{id:string; part_bytes:number}>(`/workspaces/${target}/uploads`, {method:'POST', body:JSON.stringify({name:file.name,size:file.size})});
            staged = job.id;
            let offset = 0;
            while (offset < file.size) {
              const end = Math.min(offset + job.part_bytes, file.size);
              let sent = false;
              for (let attempt = 0; attempt < 3 && !sent; attempt++) {
                try {
                  await api(`/workspaces/${target}/uploads/${job.id}?offset=${offset}`, {method:'PUT', headers:{'Content-Type':'application/octet-stream'}, body:file.slice(offset,end)});
                  sent = true;
                } catch (error) {
                  const state = await api<{offset:number}>(`/workspaces/${target}/uploads/${job.id}`);
                  if (state.offset === end) sent = true;
                  else if (state.offset !== offset || attempt === 2) throw error;
                }
              }
              offset = end;
              setUploadProgress(`Uploading ${index + 1} of ${list.length}: ${file.name} · ${Math.round(offset / file.size * 100)}%`);
            }
            const doc = await api<Doc & {duplicate?:boolean}>(`/workspaces/${target}/uploads/${job.id}/complete`, {method:'POST'});
            staged = null;
            documents = [doc];
          } else {
            const data = new FormData(); data.append('files', file);
            documents = (await api<{documents:(Doc & {duplicate?:boolean})[]}>(`/workspaces/${target}/documents`, {method:'POST', body:data})).documents;
          }
          for (const doc of documents) {
            if (!doc.id) problems.push(`${doc.name}: ${doc.error}`);
            else if (doc.duplicate) duplicates++;
            else added.push(doc.id);
          }
        } catch (error) {
          problems.push(`${file.name}: ${(error as Error).message}`);
          if (staged) await api(`/workspaces/${target}/uploads/${staged}`, {method:'DELETE'}).catch(() => undefined);
        }
        if (scope.current === target) {
          setUploadSummary({ids:[...added], duplicates});
          await refresh().catch(() => undefined);
        }
      }
      if (scope.current === target && problems.length) setError(problems.join(' '));
    } finally {setUploading(false); setUploadProgress(''); if (input.current) input.current.value = '';}
  }

  async function loadChat(id: string) {
    if (busy) return;
    try {
      const item = await api<SavedChat>(`/workspaces/${wid}/conversations/${id}`);
      if (scope.current !== wid) return;
      activeChat.current=id; setChatId(id); chatTitle.current=item.title;
      chatMessages.current=item.messages; setMessages(item.messages); setSource(null); setEvidenceTab('sources'); navigate('chat');
    } catch(e) {setError((e as Error).message);}
  }
  function newChat() {
    if (busy) return;
    activeChat.current=null;setChatId(null);chatTitle.current='New chat';chatMessages.current=[];
    setMessages([]);setNotes('');setQuery('');setSource(null);setEvidenceTab('sources');navigate('chat');
  }
  async function renameChat(item: ChatSummary) {
    const name=window.prompt('Conversation name',item.title)?.trim();
    if(!name || name===item.title) return;
    try {
      await api(`/workspaces/${wid}/conversations/${item.id}`,{method:'PATCH',body:JSON.stringify({title:name})});
      setChats(old=>old.map(c=>c.id===item.id?{...c,title:name}:c));
      if(activeChat.current===item.id) chatTitle.current=name;
    }catch(e){setError((e as Error).message);}
  }
  async function deleteChat(item: ChatSummary) {
    if(busy || !window.confirm(`Delete “${item.title}”?`))return;
    try {
      await api(`/workspaces/${wid}/conversations/${item.id}`,{method:'DELETE'});
      setChats(old=>old.filter(c=>c.id!==item.id));
      if(activeChat.current===item.id)newChat();
    }catch(e){setError((e as Error).message);}
  }
  async function ask(question = query) {
    if (!question.trim() || busy) return;
    const target=wid;
    const history=chatMessages.current.slice(-12).map(m=>({role:m.role,content:m.content.slice(0,6000)}));
    setQuery('');setTab('chat');setError('');setBusy(true);
    const title=chatTitle.current==='New chat'?question.trim().slice(0,100):chatTitle.current;
    const previous=chatMessages.current;
    const pending: Message[]=[...previous,{role:'user',content:question}];
    chatMessages.current=pending;setMessages(pending);
    let id=activeChat.current;
    try {
      if (!id) {
        const created=await api<SavedChat>(`/workspaces/${target}/conversations`,{method:'POST',body:JSON.stringify({title,messages:pending})});
        id=created.id;activeChat.current=id;setChatId(id);chatTitle.current=title;
        setChats(old=>[{id:created.id,title,updated:created.updated},...old]);
      }
      const result=await api<Answer>(`/workspaces/${target}/chat`,{method:'POST',body:JSON.stringify({question,history,document_ids:selected})});
      if(scope.current!==target)return;
      const completed:Message[]=[...pending,{role:'assistant',content:result.answer,result}];
      chatMessages.current=completed;setMessages(completed);setEvidenceTab('sources');
      const saved=await api<SavedChat>(`/workspaces/${target}/conversations/${id}`,{method:'PUT',body:JSON.stringify({title,messages:completed})});
      setChats(old=>[{id:saved.id,title:saved.title,updated:saved.updated},...old.filter(c=>c.id!==saved.id)]);
    } catch(e) {
      if(scope.current===target) {
        setError((e as Error).message);
        if(id) {
          // Preserve the submitted question if generation failed.
          await api(`/workspaces/${target}/conversations/${id}`,{method:'PUT',body:JSON.stringify({title,messages:pending})}).catch(()=>undefined);
        }
      }
    } finally {setBusy(false);}
  }
  async function remove(doc: Doc) {
    if (!confirm(`Delete “${doc.name}” and its indexed content? Existing insight reports will also be removed.`)) return;
    try {
      await api(`/workspaces/${wid}/documents/${doc.id}`, {method:'DELETE'});
      setSource(null); setPreview(null); setUploadSummary(null); await refresh();
    } catch(e) {setError((e as Error).message);}
  }
  async function retry(doc: Doc) {
    try {await api(`/workspaces/${wid}/documents/${doc.id}/retry`, {method:'POST'}); setSource(null); setPreview(null); await refresh();}
    catch(e) {setError((e as Error).message);}
  }
  async function inspect(doc: Doc) {
    try {setPreview(await api(`/workspaces/${wid}/documents/${doc.id}/chunks`));}
    catch(e) {setError((e as Error).message);}
  }
  function navigate(next: typeof tab) {
    flushSync(() => {
      if (next !== tab) setOpenReports([]);
      setTab(next); setSidebarOpen(false);
    });
  }

  async function openReport(id: string) {
    if (openingReport) return;
    if (openReports.includes(id)) {setOpenReports(old => old.filter(value => value !== id)); return;}
    const target = wid;
    if (analyses.find(a => a.id === id)?.result) {setOpenReports(old => [...old, id]); return;}
    flushSync(() => setOpeningReport(id));
    try {
      const report = await api<Analysis>(`/workspaces/${target}/analyses/${id}`);
      if (scope.current !== target) return;
      setAnalyses(old => old.map(a => a.id === id ? report : a));
      setOpenReports(old => [...old, id]);
    } catch(e) {if (scope.current === target) setError((e as Error).message);}
    finally {setOpeningReport('');}
  }
  async function insight(kind: string) {
    if (startingInsight) return;
    const target = wid;
    flushSync(() => {setTab('insights'); setStartingInsight(kind); setError('');});
    try {
      const job = await api<{id: string; status: string; reused: boolean}>(`/workspaces/${target}/analyses`, {method:'POST', body:JSON.stringify({kind})});
      if (scope.current !== target) return;
      setNotice(job.reused ? (job.status === 'ready' ? 'Your documents have not changed. The existing report is ready to open.' : 'This report is already queued or processing.') : 'Report queued. You can keep using Atlas while it processes your documents.');
      await refresh();
    } catch(e) {if (scope.current === target) setError((e as Error).message);}
    finally {setStartingInsight('');}
  }
  async function addWorkspace(e: React.FormEvent) {
    e.preventDefault();
    try {const value = await api<Workspace>('/workspaces', {method:'POST', body:JSON.stringify({name:workspaceName})}); setWorkspaces(old => [...old, value]); setWid(value.id); setNewWorkspace(false); setWorkspaceName('');}
    catch(e) {setError((e as Error).message);}
  }
  async function signOut() {
    try {await api('/auth/logout', {method:'POST'}); setUser(null); setPassword(''); setDocs([]); setMessages([]); setWid(''); setPreview(null); setSource(null);}
    catch(e) {setError((e as Error).message);}
  }


  useEffect(() => {
    function shortcuts(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {event.preventDefault(); setSearchOpen(true);}
      if (event.key === 'Escape') {setSearchOpen(false); setScopeOpen(false); setNewWorkspace(false); setSource(null); setPreview(null); setSidebarOpen(false);}
    }
    window.addEventListener('keydown', shortcuts);
    return () => window.removeEventListener('keydown', shortcuts);
  }, []);

  const ready = docs.filter(d => d.status === 'ready');
  const filtered = docs.filter(d => d.name.toLowerCase().includes(filter.toLowerCase()));
  const workspace = workspaces.find(w => w.id === wid);
  const totalChunks = docs.reduce((sum,d) => sum + d.chunk_count, 0);
  const storage = docs.reduce((sum,d) => sum + d.size, 0);
  const latestAnswer = [...messages].reverse().find(m => m.result)?.result;
  // Only passages actually cited in the answer count as supporting evidence.
  // Preserve original retrieval indices so [3] always opens source 3.
  const visibleEvidence = (result: Answer | undefined) => {
    if (!result || !['ai', 'local_excerpts'].includes(result.mode)) return [];
    const cited = new Set(Array.from(result.answer.matchAll(/\[(\d+)\]/g), m => Number(m[1])));
    return result.sources.flatMap((source, index) => cited.has(index + 1) ? [{source, number: index + 1}] : []);
  };
  const evidenceItems = visibleEvidence(latestAnswer);
  const sources = evidenceItems.map(item => item.source);
  const related = Array.from(new Map(messages.flatMap(m => m.result?.sources || []).filter(s => !sources.some(latest => latest.document_id === s.document_id)).map(s => [s.document_id,s])).values());
  const title = messages.find(m => m.role === 'user')?.content || 'New research';
  const initials = user?.email.slice(0,2).toUpperCase() || 'A';
  const uploadedDocs = uploadSummary ? docs.filter(d => uploadSummary.ids.includes(d.id)) : [];
  const uploadStatus = uploadSummary ? [
    ...(['queued','processing','ready','failed'] as const).map(status => {const count=uploadedDocs.filter(d=>d.status===status).length;return count ? `${count} ${status === 'ready' ? 'ready to search' : status}` : '';}),
    uploadSummary.duplicates ? `${uploadSummary.duplicates} duplicates skipped` : '',
    uploadSummary.ids.some(id => !docs.some(d => d.id === id)) ? 'Refreshing document status' : '',
  ].filter(Boolean).join(' · ') : '';

  function citationText(children: ReactNode, evidence: Source[]) {
    return Children.map(children, child => typeof child === 'string' ? child.split(/(\[\d+\])/g).map((part,index) => {
      const match = /^\[(\d+)\]$/.exec(part);
      const passage = match ? evidence[Number(match[1])-1] : null;
      return passage ? <button key={index} className="cite" onClick={() => setSource(passage)} aria-label={`Open source ${match![1]}: ${passage.name}`}>{match![1]}</button> : part;
    }) : child);
  }
  function renderAnswer(result: Answer) {
    return <><div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{p:({children})=><p>{citationText(children,result.sources)}</p>,li:({children})=><li>{citationText(children,result.sources)}</li>}}>{result.answer}</ReactMarkdown></div>{visibleEvidence(result).length > 0 && <div className="source-chips">{visibleEvidence(result).map(({source:s,number}) => <button className="source-chip" key={s.chunk_id} onClick={() => setSource(s)}><FileBadge name={s.name}/><span><b>{s.name}</b><small>{result.mode === 'local_excerpts' ? 'Search match' : 'Citation'} [{number}] · {s.location_type === 'page' ? 'Page' : 'Section'} {s.page}</small></span></button>)}</div>}</>;
  }
  async function copyConversation() {
    try {await navigator.clipboard.writeText(messages.map(m => `${m.role === 'user' ? 'You' : 'Atlas'}\n${m.content}`).join('\n\n')); setCopied(true); window.setTimeout(() => setCopied(false),2000);}
    catch {setError('Could not copy the conversation.');}
  }
  const uploadButton = <button className="btn primary" disabled={uploading || !wid} onClick={() => input.current?.click()}>{uploading ? <LoaderCircle className="spin"/> : <Plus/>}<span>{uploading ? 'Uploading…' : 'Add documents'}</span></button>;

  if (loading) return <div className="opening"><AtlasMark/><LoaderCircle className="spin"/><span>Opening your research workspace…</span></div>;
  if (!user) return <div className="auth-page"><header><div className="brand-row"><AtlasMark/><span>Atlas</span></div>{themeButton}</header><div className="auth-grid"><div className="auth-intro"><span className="eyebrow">YOUR RESEARCH WORKSPACE</span><h1>Your knowledge,<br/>a conversation away.</h1><p>Bring your documents together. Ask better questions. Follow every answer back to the evidence.</p><div className="auth-points"><span><FileText/>All your documents, one place</span><span><MessageSquare/>Questions with context</span><span><ShieldCheck/>A workspace of your own</span></div></div><form className="auth-form" onSubmit={authenticate}><h2>{register ? 'Create your workspace' : 'Welcome back'}</h2><p>{register ? 'Make room for your next discovery.' : 'Continue where your research left off.'}</p><label>Email address<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com"/></label><label>Password<input type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={10} maxLength={200} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 10 characters"/></label>{error && <div className="feedback error" role="alert">{error}</div>}<button className="btn primary" disabled={busy}>{busy ? <LoaderCircle className="spin"/> : <ArrowUpRight/>}{register ? 'Create account' : 'Sign in'}</button><div className="auth-switch">{register ? 'Already have an account?' : 'New to Atlas?'} <button type="button" onClick={()=>{setRegister(!register);setError('');}}>{register ? 'Sign in' : 'Create an account'}</button></div></form></div></div>;

  return <div className={`app ${sidebarCollapsed ? 'collapsed' : ''}`}>
    <input ref={input} type="file" multiple accept=".pdf,.docx,.txt,.md" hidden onChange={e=>{if(e.target.files) void upload(e.target.files);}}/>
    {sidebarOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={()=>setSidebarOpen(false)}/>}
    <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
      <div className="brand-row"><AtlasMark/><span>Atlas</span><button className="sidebar-collapse" aria-label="Collapse sidebar" onClick={()=>{setSidebarCollapsed(true);setSidebarOpen(false);}}><PanelLeftClose/></button></div>
      <button className="workspace-btn" onClick={()=>setNewWorkspace(true)}><span className="ws-avatar">{workspace?.name[0]?.toUpperCase() || 'A'}</span><span><strong>{workspace?.name || 'Choose workspace'}</strong><small>{workspaces.length} workspace{workspaces.length===1?'':'s'}</small></span><ChevronDown/></button>
      <nav className="nav" aria-label="Main navigation">{([{id:'overview',label:'Home',icon:HomeIcon},{id:'chat',label:'Ask Atlas',icon:Search},{id:'documents',label:'Documents',icon:FileText}] as const).map(item=><button key={item.id} className={tab===item.id?'active':''} title={item.label} aria-current={tab===item.id?'page':undefined} onClick={()=>navigate(item.id)}><item.icon/><span>{item.label}</span></button>)}</nav>
      <div className="sidebar-research"><div className="section-label">IN THIS WORKSPACE</div><button className="workspace-stat" onClick={()=>navigate('documents')}><FolderOpen/><span>{docs.length} documents</span></button><button className="workspace-stat" onClick={()=>navigate('chat')}><Layers3/><span>{totalChunks.toLocaleString()} searchable passages</span></button></div>
      <div className="bottom"><div className="usage"><div><span>Workspace storage</span><span>{storage ? prettyBytes(storage) : '0 KB'}</span></div><p>{ready.length} documents ready to explore</p></div><div className="profile"><span className="avatar">{initials}</span><div><strong>{user.email.split('@')[0]}</strong><small>{user.email}</small></div><button className="icon-button" aria-label="Sign out" title="Sign out" onClick={()=>void signOut()}><LogOut/></button></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><button className="icon-button mobile" aria-label="Open menu" onClick={()=>setSidebarOpen(true)}><Menu/></button><button className="icon-button expand-sidebar" aria-label="Expand sidebar" onClick={()=>setSidebarCollapsed(false)}><PanelLeftOpen/></button><button className="global-search" onClick={()=>setSearchOpen(true)}><Search/><span>Search documents or ask a question…</span><kbd className="key">⌘ K</kbd></button><div className="top-actions">{themeButton}<button className="initials" aria-label="Manage workspaces" onClick={()=>setNewWorkspace(true)}>{initials}</button></div></header>
      <div className="content">
        {error && <div className="feedback error" role="alert"><AlertCircle/><span>{error}</span><button className="icon-button" aria-label="Dismiss error" onClick={()=>setError('')}><X/></button></div>}
        {notice && <div className="feedback" role="status"><CheckCircle2/><span>{notice}</span><button className="icon-button" aria-label="Dismiss notice" onClick={()=>setNotice('')}><X/></button></div>}
        {uploadProgress && <div className="feedback" role="status"><LoaderCircle className="spin"/><span>{uploadProgress}</span></div>}
        {uploadSummary && <div className="feedback" role="status"><Upload/><span>{uploadStatus || 'No files added'} <button className="text-button" onClick={()=>navigate('documents')}>View documents</button></span><button className="icon-button" aria-label="Dismiss upload status" onClick={()=>setUploadSummary(null)}><X/></button></div>}
        {!wid && <EmptyState icon={<FolderOpen/>} title="A new space for your knowledge" text="Create a workspace to add documents and begin researching." action={<button className="btn primary" onClick={()=>setNewWorkspace(true)}><Plus/>Create workspace</button>}/>}
        {wid && tab==='overview' && <section>
          <div className="crumb">Workspace<span>›</span>Home</div><div className="home-intro"><h1>Your documents, within reach.</h1><p>Find answers, revisit your sources, and continue your research.</p></div>
          <div className="home-ask"><h2>Ask Atlas</h2><form onSubmit={e=>{e.preventDefault();void ask();}}><textarea aria-label="Ask your documents" placeholder="What would you like to know about your documents?" value={query} maxLength={4000} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(ready.length)void ask();}}}/><div className="home-ask-footer"><span className="caption">{ready.length} ready documents · Answers linked to sources</span><button className="btn primary" disabled={busy || !ready.length || !query.trim()}><ArrowUpRight/>Ask a question</button></div></form></div>
          <div className="home-grid"><div><div className="block-head"><h2>Recent documents</h2><button onClick={()=>navigate('documents')}>View all →</button></div><div className="list-card">{docs.length?docs.slice(0,5).map(d=><button className="list-row" key={d.id} onClick={()=>void inspect(d)}><FileBadge name={d.name}/><div><strong>{d.name}</strong><small>{prettyBytes(d.size)} · {d.chunk_count} passages</small></div><ChevronRight/></button>):<EmptyState icon={<FileText/>} title="Start with your documents" text="Add a PDF, Word document, or text file." action={uploadButton}/>}</div></div><div><div className="block-head"><h2>Continue researching</h2><button onClick={()=>navigate('chat')}>Open chat →</button></div><div className="list-card">{messages.some(m=>m.role==='user')?messages.filter(m=>m.role==='user').slice(-4).reverse().map((m,i)=><button className="list-row" key={i} onClick={()=>navigate('chat')}><MessageSquare/><div><strong>{m.content}</strong><small>Current conversation</small></div><ChevronRight/></button>):<EmptyState icon={<Search/>} title="Follow your curiosity" text="Your research begins with a question." action={<button className="btn" onClick={()=>navigate('chat')}>Start researching<ArrowUpRight/></button>}/>}</div></div></div>
          <div className={`upload-area ${dragging?'dragging':''}`} onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);void upload(e.dataTransfer.files);}}><Upload/><div><strong>Make room for more knowledge</strong><p>Drop PDF, DOCX, TXT, or MD files · up to {Math.round(user.max_file_bytes/1024/1024)} MB each</p></div>{uploadButton}</div>
        </section>}
        {wid && tab==='chat' && <section>
          <div className="crumb">Ask Atlas<span>›</span><span className="crumb-title">{title}</span></div><div className="heading-row"><div className="research-heading"><h1 title={title}>{title}</h1><p className="subtitle">Answers grounded in your documents, with evidence you can inspect.</p></div><div className="actions"><button className="btn hide-small" disabled={!messages.length} onClick={()=>void copyConversation()}>{copied?<Check/>:<Copy/>}{copied?'Copied':'Copy chat'}</button><button className="btn primary" disabled={busy} onClick={newChat}><Plus/><span>New chat</span></button></div></div>
          <div className="filters"><button className="filter" onClick={()=>setScopeOpen(true)}><FileText/>{selected.length?`${selected.length} selected documents`:'All documents'}<ChevronDown/></button><span className="research-mode"><i/>{user.mode==='ai'?'AI research':'Source search'} · {ready.length} ready documents</span></div>
          {user.mode !== 'ai' && <div className="feedback" role="status"><CircleHelp/><span><strong>Source search only.</strong> Atlas can find relevant passages, but it cannot write synthesized answers until an AI provider is configured. Set <code>AI_PROVIDER=openai</code> with <code>OPENAI_API_KEY</code>, or use <code>AI_PROVIDER=ollama</code>, then restart the API.</span></div>}
          <div className="chat-workspace"><aside className="chat-history"><div className="chat-history-header"><strong>Conversations</strong><button type="button" onClick={newChat} title="New conversation" aria-label="New conversation"><Plus size={16}/></button></div><div className="chat-history-list">{chats.map(item=><div className={`chat-history-item ${chatId===item.id?'current':''}`} key={item.id}><button className="chat-history-open" onClick={()=>void loadChat(item.id)} disabled={busy} title={item.title}><MessageSquare size={15}/><span>{item.title}</span></button><button className="chat-history-action" onClick={()=>void renameChat(item)} disabled={busy} aria-label={`Rename ${item.title}`} title="Rename">✎</button><button className="chat-history-action" onClick={()=>void deleteChat(item)} disabled={busy} aria-label={`Delete ${item.title}`} title="Delete"><Trash2 size={14}/></button></div>)}{!chats.length&&<p className="caption chat-history-empty">Your saved conversations will appear here.</p>}</div></aside><div className="research"><div className="chat-pane"><div className="thread">
            {!messages.length && <div className="research-welcome"><span className="welcome-mark"><AtlasMark/></span><span className="eyebrow">ASK YOUR KNOWLEDGE</span><h2>Ask your documents anything.</h2><p>{ready.length?'Find a specific detail, compare documents, or follow an idea back to its source.':'Add your first documents to explore them with Atlas.'}</p>{!ready.length?uploadButton:<div className="starter-questions">{prompts.map(p=><button key={p} onClick={()=>void ask(p)}>{p}<ArrowUpRight/></button>)}</div>}</div>}
            {messages.map((m,i)=>m.role==='user'?<div className="user-message" key={i}><div className="bubble-row"><span className="circle">{initials}</span><div className="bubble">{m.content}</div></div></div>:<div className="answer-row" key={i}><span className="assistant-mark">A</span><div className="answer"><div className="answer-head"><strong>Atlas</strong><span>{m.result?.mode==='ai'?'AI synthesis':m.result?.mode==='local_excerpts'?'Source excerpts':'Evidence check'}</span></div>{m.result?renderAnswer(m.result):<p>{m.content}</p>}</div></div>)}
            {busy && <div className="thinking" role="status"><LoaderCircle className="spin"/><span>Reading the relevant evidence…</span></div>}<div ref={chatEnd}/>
          </div>{messages.length>0 && <div className="prompt-row">{['What are the key risks?','What should be built first?','Summarize the next steps'].map(p=><button key={p} disabled={busy || !ready.length} onClick={()=>void ask(p)}>{p}</button>)}</div>}
          <form className="composer" onSubmit={e=>{e.preventDefault();void ask();}}><button className="icon-button" type="button" aria-label="Add documents" disabled={uploading} onClick={()=>input.current?.click()}><Plus/></button><textarea aria-label="Your question" placeholder={messages.length?'Ask a follow-up question…':'Ask a question about your documents…'} rows={1} maxLength={4000} value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(ready.length)void ask();}}}/><button className="send" aria-label="Send question" disabled={busy || !query.trim() || !ready.length}>{busy?<LoaderCircle className="spin"/>:<ArrowUp/>}</button></form><p className="caption composer-caption">{messages.length?'Follow-ups use this conversation’s context. ':''}Review supporting passages before relying on an answer.</p></div>
          <aside className="evidence-panel"><div className="tabs" role="tablist" aria-label="Research evidence">{(['sources','notes','related'] as const).map(t=><button key={t} role="tab" aria-selected={evidenceTab===t} aria-controls={`evidence-${t}`} id={`tab-${t}`} className={evidenceTab===t?'selected':''} onClick={()=>setEvidenceTab(t)}>{t[0].toUpperCase()+t.slice(1)}{t==='sources'&&sources.length>0&&<span className="tab-count">{sources.length}</span>}</button>)}</div><div role="tabpanel" id={`evidence-${evidenceTab}`} aria-labelledby={`tab-${evidenceTab}`}>
            {evidenceTab==='sources' && (sources.length?evidenceItems.map(({source:s,number})=><button className="doc-item" key={s.chunk_id} onClick={()=>setSource(s)}><FileBadge name={s.name}/><span className="doc-item-info"><strong>{s.name}</strong><small>{latestAnswer?.mode==='local_excerpts'?'Search match':'Citation'} [{number}] · {s.location_type==='page'?'Page':'Section'} {s.page}</small></span><ChevronRight/></button>):<div className="evidence-placeholder"><FileText/><h3>Your evidence, alongside</h3><p>Only passages cited in the answer appear here. Ask a question to see its evidence.</p></div>)}
            {evidenceTab==='notes' && <div className="research-notes"><label htmlFor="research-notes">Your research notes</label><textarea id="research-notes" placeholder="Capture a finding, a question, or something to revisit…" value={notes} onChange={e=>setNotes(e.target.value)}/><p className="caption">Notes stay in this research session.</p><button className="btn" disabled={!notes.trim()} onClick={()=>{const url=URL.createObjectURL(new Blob([notes],{type:'text/plain'}));const a=document.createElement('a');a.href=url;a.download='atlas-research-notes.txt';a.click();URL.revokeObjectURL(url);}}><Download/>Export notes</button></div>}
            {evidenceTab==='related' && <><p className="panel-caption">Sources from earlier answers in this conversation.</p>{related.length?related.map(s=><button className="doc-item" key={s.document_id} onClick={()=>setSource(s)}><FileBadge name={s.name}/><span className="doc-item-info"><strong>{s.name}</strong><small>Previously referenced</small></span><ChevronRight/></button>):<div className="evidence-placeholder"><Layers3/><h3>Keep connecting the dots</h3><p>Earlier sources will collect here as your conversation explores more documents.</p></div>}</>}
          </div></aside></div>
        </section>}
        {wid && tab==='documents' && <section><div className="crumb">Workspace<span>›</span>Documents</div><div className="heading-row"><div><h1>Documents</h1><p className="subtitle">The files behind your answers.</p></div>{uploadButton}</div><div className="library-bar"><label className="document-search"><Search/><input type="search" aria-label="Search documents" placeholder="Search documents…" value={filter} onChange={e=>setFilter(e.target.value)}/></label><span className="caption">{filtered.length} of {docs.length} documents</span></div>{renderDocuments(filtered)}<div className={`upload-area ${dragging?'dragging':''}`} onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);void upload(e.dataTransfer.files);}}><Upload/><div><strong>Drop your documents here</strong><p>PDF, DOCX, TXT, MD · up to {Math.round(user.max_file_bytes/1024/1024)} MB per file</p></div><button className="btn" disabled={uploading} onClick={()=>input.current?.click()}>Browse files</button></div></section>}
        {wid && tab==='insights' && <section className="insights-section" aria-busy={!!startingInsight || !!openingReport}><div className="crumb">Workspace<span>›</span>Insights</div><div className="heading-row"><div><h1>Insights</h1><p className="subtitle">A closer look at the knowledge in your workspace.</p></div><span className="scope-tag"><FileText/>{ready.length} ready documents</span></div>
          {(startingInsight || openingReport) && <div className="loading-overlay" role="status"><div><LoaderCircle className="spin"/><h2>{openingReport?'Opening your report':'Preparing your analysis'}</h2><p>Gathering the findings and supporting evidence…</p></div></div>}
          <div className="insight-tools">{[{kind:'summary',title:'Collection summary',text:'The key facts and decisions.',icon:BookOpen},{kind:'risks',title:'Risks & open issues',text:'Concerns worth a closer look.',icon:ShieldCheck},{kind:'timeline',title:'Dated events',text:'Events with dates from the source.',icon:Clock3}].map(item=>{const running=analyses.some(a=>a.kind===item.kind&&['queued','processing'].includes(a.status));return <button className="insight-tool" key={item.kind} disabled={!ready.length || !!startingInsight || running} onClick={()=>void insight(item.kind)}><span className="insight-icon"><item.icon/></span><strong>{item.title}</strong><small>{running?'Analysis in progress':item.text}</small><ArrowUpRight/></button>;})}</div><p className="caption insight-explanation">Reviews every indexed passage. Large collections can take time. {user.mode!=='ai'&&'AI is disabled; reports contain source excerpts.'}</p>
          {!analyses.length && <EmptyState icon={<Lightbulb/>} title="See your knowledge in a new light" text="Choose an analysis above to explore your documents."/>}
          {analyses.map(a=><article className="report" key={a.id}><div className="report-heading"><div><span className="eyebrow">WORKSPACE REPORT</span><h2>{a.kind==='summary'?'Collection summary':a.kind==='risks'?'Risks & unresolved issues':'Dated events'}</h2></div><Status status={a.status}/></div>{['queued','processing'].includes(a.status)&&<div className="report-progress" role="status"><LoaderCircle className="spin"/><div><strong>{a.status==='queued'?'Waiting to start':'Analyzing your documents'}</strong><p>Your report will appear here when ready. You can keep researching.</p></div></div>}{a.error&&<p className="feedback error">{a.error}</p>}{a.status==='ready'&&<button className="btn" disabled={!!openingReport} onClick={()=>void openReport(a.id)}>{openReports.includes(a.id)?'Close report':'Open report'}<ChevronRight/></button>}{a.result&&openReports.includes(a.id)&&<div className="report-results"><div className="coverage"><ShieldCheck/>Reviewed {a.result.coverage.analyzed} of {a.result.coverage.total} documents · {a.result.coverage.excluded.length} excluded</div>{a.result.coverage.excluded.map(d=><p className="caption" key={d.name}>Excluded: {d.name} ({d.status})</p>)}{a.result.documents.map(d=><ReportDocument key={d.document_id} name={d.name} batches={d.batches} renderAnswer={renderAnswer}/>)}<p className="caption">{a.result.note}</p></div>}</article>)}
        </section>}
      </div>
    </main>
    {searchOpen && <Dialog title="Search your workspace" onClose={()=>setSearchOpen(false)} className="search-dialog"><div className="modal-search"><Search/><input autoFocus aria-label="Search your workspace" placeholder="Find a document or ask a question…" value={globalQuery} onChange={e=>setGlobalQuery(e.target.value)}/></div>{globalQuery.trim()&&<button className="search-question" disabled={busy || !ready.length} onClick={()=>{setSearchOpen(false);void ask(globalQuery);setGlobalQuery('');}}><Sparkles/><span>Ask Atlas: {globalQuery}</span><ArrowUpRight/></button>}<div className="search-results">{docs.filter(d=>d.name.toLowerCase().includes(globalQuery.toLowerCase())).slice(0,12).map(d=><button className="doc-item" key={d.id} onClick={()=>{setSearchOpen(false);void inspect(d);}}><FileBadge name={d.name}/><span className="doc-item-info"><strong>{d.name}</strong><small>{prettyBytes(d.size)} · {d.chunk_count} passages</small></span><ChevronRight/></button>)}{!docs.some(d=>d.name.toLowerCase().includes(globalQuery.toLowerCase()))&&<p className="evidence-empty">No matching documents.</p>}</div></Dialog>}
    {scopeOpen && <Dialog title="Choose your sources" onClose={()=>setScopeOpen(false)}><p className="dialog-intro">Ask across all ready documents, or choose a focused set.</p><button className="btn" onClick={()=>setSelected([])}><Layers3/>Use all documents</button><div className="scope-list">{ready.map(d=><label key={d.id}><input type="checkbox" checked={selected.includes(d.id)} onChange={e=>setSelected(old=>e.target.checked?[...old,d.id]:old.filter(id=>id!==d.id))}/><FileBadge name={d.name}/><span>{d.name}</span></label>)}</div><div className="dialog-footer"><span className="caption">{selected.length?`${selected.length} selected`:'All ready documents included'}</span><button className="btn primary" onClick={()=>setScopeOpen(false)}>Done<Check/></button></div></Dialog>}
    {newWorkspace && <Dialog title="Your workspaces" onClose={()=>setNewWorkspace(false)}><p className="dialog-intro">Keep documents and research organized in their own space.</p><div className="workspace-list">{workspaces.map(w=><button className={w.id===wid?'selected':''} key={w.id} disabled={busy || uploading} onClick={()=>{setWid(w.id);setNewWorkspace(false);}}><span className="ws-avatar">{w.name[0].toUpperCase()}</span><strong>{w.name}</strong>{w.id===wid?<Check/>:<ChevronRight/>}</button>)}</div><form className="workspace-form" onSubmit={addWorkspace}><label>New workspace<input required maxLength={100} value={workspaceName} onChange={e=>setWorkspaceName(e.target.value)} placeholder="e.g. Product research"/></label><button className="btn primary"><Plus/>Create workspace</button></form></Dialog>}
    {(source || preview) && <><button className="drawer-cover open" aria-label="Close source preview" onClick={()=>{setSource(null);setPreview(null);}}/><aside className="drawer open" role="dialog" aria-modal="true" aria-label={source?'Source passage':'Document preview'}><div className="drawer-header"><div><div className="caption">{source?'SUPPORTING EVIDENCE':'DOCUMENT PREVIEW'}</div><h2>{source?.name || preview?.document.name}</h2><div className="caption">{source?`${source.location_type==='page'?'Page':'Section'} ${source.page}`:`${preview?.document.chunk_count} passages · ${preview?.document.status}`}</div></div><button autoFocus className="icon-button" aria-label="Close preview" onClick={()=>{setSource(null);setPreview(null);}}><X/></button></div><div className="drawer-body">{source?<div className="highlight"><DocumentPassage name={source.name} text={source.text}/></div>:preview&&<>{preview.document.error&&<p className="feedback error">{preview.document.error}</p>}{preview.chunks.map(c=><section className="preview-chunk" key={c.id}><span className="caption">{preview.document.name.toLowerCase().endsWith('.pdf')?'Page':'Section'} {c.page}</span><DocumentPassage name={preview.document.name} text={c.text}/></section>)}{!preview.chunks.length&&<p className="evidence-empty">No indexed passages yet.</p>}{preview.document.chunk_count>preview.chunks.length&&<button className="btn" onClick={async()=>{try{const next=await api<typeof preview>(`/workspaces/${wid}/documents/${preview.document.id}/chunks?offset=${preview.chunks.length}`);if(next)setPreview({...preview,chunks:[...preview.chunks,...next.chunks]});}catch(e){setError((e as Error).message);}}}>Load more passages</button>}</>}</div><div className="drawer-footer"><a className="btn" href={`/api/workspaces/${wid}/documents/${source?.document_id || preview?.document.id}/original`}><Download/>Download original</a><button className="btn" onClick={()=>{setSource(null);setPreview(null);}}>Close</button></div></aside></>}
  </div>;

  function renderDocuments(items: Doc[]) {
    if (!items.length) return <EmptyState icon={<FolderOpen/>} title={filter?'No matching documents':'Your knowledge starts here'} text={filter?'Try another name or clear the search.':'Add documents to find answers, compare ideas, and explore the evidence.'} action={filter?<button className="btn" onClick={()=>setFilter('')}>Clear search</button>:uploadButton}/>;
    return <div className="table-wrap"><table className="document-table"><thead><tr><th>Document</th><th>Type</th><th>Size</th><th>Passages</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{items.map(d=><tr key={d.id}><td><button className="document-name" onClick={()=>void inspect(d)}><FileBadge name={d.name}/><span><strong>{d.name}</strong>{d.error&&<small className="document-error">{d.error}</small>}</span></button></td><td>{d.name.split('.').pop()?.toUpperCase()}</td><td>{prettyBytes(d.size)}</td><td>{d.chunk_count || '—'}</td><td><Status status={d.status}/></td><td><div className="row-actions">{['ready','failed'].includes(d.status)&&<button className="icon-button" aria-label={`Reindex ${d.name}`} title="Reindex document" onClick={()=>void retry(d)}><RotateCcw/></button>}<a className="icon-button" aria-label={`Download ${d.name}`} href={`/api/workspaces/${wid}/documents/${d.id}/original`}><Download/></a><button className="icon-button destructive" aria-label={`Delete ${d.name}`} title="Delete document" onClick={()=>void remove(d)}><Trash2/></button></div></td></tr>)}</tbody></table></div>;
  }
}

function AtlasMark() {return <span className="mark" aria-hidden="true"><svg viewBox="0 0 30 30"><path d="M9 3c2 0 4 2 5.2 5l5.6 13c1 2.5-.2 5.2-2.9 6-2.5.7-4.6-.5-5.6-3L5.9 11C4.6 7.7 6 3 9 3Z"/><path d="M21 7c2.4 0 4 3.4 4 6l-1 10c-.3 3.5-4 5-6.5 3.2-1.8-1.2-2-3-1.3-5l3.1-10C19.8 9 20 7 21 7Z" fill="#67af88"/></svg></span>;}
function FileBadge({name}: {name:string}) {const extension=name.split('.').pop()?.toLowerCase()||'txt';return <span className={`file ${extension}`}>{extension.toUpperCase()}</span>;}
function Status({status}: {status:string}) {return <span className={`status status-${status}`}>{['queued','processing'].includes(status)?<LoaderCircle className="spin"/>:status==='ready'?<Check/>:status==='failed'?<AlertCircle/>:null}{status==='ready'?'Ready':status[0].toUpperCase()+status.slice(1)}</span>;}
function EmptyState({icon,title,text,action}: {icon:ReactNode;title:string;text:string;action?:ReactNode}) {return <div className="empty-state"><span>{icon}</span><h3>{title}</h3><p>{text}</p>{action}</div>;}
function Dialog({title,onClose,children,className=''}: {title:string;onClose:()=>void;children:ReactNode;className?:string}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{ref.current?.showModal();const dialog=ref.current;return()=>dialog?.close();},[]);
  return <dialog ref={ref} className={`dialog ${className}`} aria-label={title} onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div className="dialog-heading"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X/></button></div>{children}</dialog>;
}
function ReportDocument({name,batches,renderAnswer}: {name:string;batches:Answer[];renderAnswer:(answer:Answer)=>ReactNode}) {
  const [open,setOpen]=useState(false);const [limit,setLimit]=useState(6);
  return <details onToggle={e=>setOpen(e.currentTarget.open)}><summary><FileText/><span>{name}</span><ChevronDown/></summary>{open&&<>{batches.slice(0,limit).map((batch,i)=><div className="report-batch" key={i}><span className="caption">Passage group {i+1}</span>{renderAnswer(batch)}</div>)}{limit<batches.length&&<button className="btn" onClick={()=>setLimit(old=>old+6)}>Show more passages ({batches.length-limit} remaining)</button>}</>}</details>;
}
