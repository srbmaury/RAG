'use client';

import {Children, useEffect, useRef, useState, useCallback, type ReactNode} from 'react';
import {ArrowUp, ArrowUpRight, BookOpen, Check, ChevronDown, ChevronRight, CircleHelp, FileText, FolderOpen, Layers3, LogOut, Plus, Search, ShieldCheck, Sparkles, Trash2, Upload, X, LoaderCircle, RotateCcw, Download, MessageSquare, Mail, Github, HardDrive, Hash, Lightbulb, Clock3, Moon, Sun, Home as HomeIcon, PanelLeftClose, PanelLeftOpen, Menu, Copy, SlidersHorizontal, CheckCircle2, AlertCircle, NotebookPen, ArrowDownToLine} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import './rebuild.css';
import {IntegrationTile} from '../components/IntegrationTile';
import {flushSync} from 'react-dom';
import remarkGfm from 'remark-gfm';

type User = {id: string; email: string; mode: string; max_file_bytes: number};
type Workspace = {id: string; name: string};
type Doc = {id: string; name: string; size: number; status: string; error?: string; pages: number; chunk_count: number};
type Source = {chunk_id: string; document_id: string; name: string; page: number; text: string; location_type: string; provider?: string; url?: string};
type Answer = {answer: string; sources: Source[]; mode: string; citation_note?: string};
type Message = {role: 'user' | 'assistant'; content: string; result?: Answer};
type GmailMessage = {id:string;subject:string;sender:string;date:string;snippet:string;body:string;url:string};
type GmailStatus = {connected:boolean;email:string|null;configured:boolean};
type GmailSummary = {summary:string;sources:{number:number;id:string;subject:string;url:string}[]};
type ChatSummary = {id: string; title: string; updated: number};
type SavedChat = ChatSummary & {messages: Message[]};

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {...options, headers: options?.body instanceof FormData ? options.headers : {'Content-Type': 'application/json', ...options?.headers}});
  if (!response.ok) {
    const value = await response.json().catch(() => ({}));
    const detail = typeof value.detail === 'string' ? value.detail
      : Array.isArray(value.detail) ? value.detail.map((item: {msg?:string}) => item.msg || 'Invalid request').join('; ')
      : '';
    throw new Error(detail || `The server returned HTTP ${response.status} for ${path}. Check the backend terminal for details.`);
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
  const [tab, setTab] = useState<'overview' | 'documents' | 'chat' | 'sources'>('chat');
  const [historyOpen,setHistoryOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [driveStatus,setDriveStatus] = useState<{connected:boolean;account:string|null;configured:boolean}|null>(null);
  const [driveQuery,setDriveQuery] = useState('');
  const [driveResults,setDriveResults] = useState<{id:string;title:string;excerpt:string;url:string}[]>([]);
  const [driveBusy,setDriveBusy] = useState(false);
  const [sourceStatuses,setSourceStatuses] = useState<{provider:string;connected:boolean;account:string|null}[]>([]);
  const [sourceManage,setSourceManage] = useState<string|null>(null);
  const [sourceProvider,setSourceProvider] = useState<'github'|'notion'|'slack'>('github');
  const [sourceCredential,setSourceCredential] = useState('');
  const [sourceSearch,setSourceSearch] = useState('');
  const [sourceResults,setSourceResults] = useState<{provider:string;id:string;title:string;excerpt:string;url?:string}[]>([]);
  const [sourceBusy,setSourceBusy] = useState(false);
  const [connectedGmail,setConnectedGmail] = useState(false);
  const [connectedProviders,setConnectedProviders] = useState<string[]>([]);
  const [connectedGmailQuery,setConnectedGmailQuery] = useState('newer_than:30d');
  useEffect(()=>{setConnectedProviders([]);setConnectedGmail(false);setSourceManage(null);},[wid]);
  const [gmailStatus,setGmailStatus] = useState<GmailStatus|null>(null);
  const [gmailMessages,setGmailMessages] = useState<GmailMessage[]>([]);
  const [gmailQuery,setGmailQuery] = useState('in:inbox newer_than:30d');
  const [gmailSummarizeQuery,setGmailSummarizeQuery] = useState('');
  const [gmailQueryLimit,setGmailQueryLimit] = useState(30);
  const [gmailQuerySummaryLabel,setGmailQuerySummaryLabel] = useState('');
  const [gmailSelected,setGmailSelected] = useState<string[]>([]);
  const [gmailSummary,setGmailSummary] = useState<GmailSummary|null>(null);
  const [gmailBusy,setGmailBusy] = useState(false);
  const [gmailSummarizing,setGmailSummarizing] = useState(false);
  const [gmailSummaryIds,setGmailSummaryIds] = useState<string[]>([]);
  const [gmailMobileView,setGmailMobileView] = useState<'emails'|'summary'>('emails');
  const [gmailPreview,setGmailPreview] = useState<GmailMessage|null>(null);
  const gmailSummaryHeading = useRef<HTMLHeadingElement>(null);
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
  const [deleteWorkspaceId, setDeleteWorkspaceId] = useState<string | null>(null);
  const [confirmWorkspaceName, setConfirmWorkspaceName] = useState('');
  const [deletingWorkspace, setDeletingWorkspace] = useState(false);
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
  const chatThread = useRef<HTMLDivElement>(null);
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
    setNotes(''); setDocs([]); setMessages([]); setChatId(null); activeChat.current=null; chatMessages.current=[]; setChats([]); setSelected([]); setPreview(null); setSource(null); setError(''); setNotice(''); setUploadSummary(null);
    setGmailMessages([]);setGmailSelected([]);setGmailSummary(null);setGmailSummaryIds([]);setGmailStatus(null);setGmailMobileView('emails');setGmailPreview(null);
    if (wid) {
      void api<GmailStatus>(`/gmail/status?wid=${encodeURIComponent(wid)}`).then(setGmailStatus).catch(()=>undefined);
      void api<ChatSummary[]>(`/workspaces/${wid}/conversations`).then(list => {if(scope.current===wid) setChats(list);}).catch(e=>setError(e.message));
    }
    void refresh().catch(e => setError(e.message));
    const timer = setInterval(() => {void refresh().catch(e => setError(e.message));}, 3000);
    return () => clearInterval(timer);
  }, [refresh]);
  useEffect(() => {if (tab==='chat' && messages.length > 0 && chatThread.current) chatThread.current.scrollTo({top:chatThread.current.scrollHeight,behavior:'smooth'});}, [messages.length,busy,tab]);

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
  async function ask(question = query, startNewConversation = false) {
    if (!question.trim() || busy) return;
    const target=wid;
    // Home is a new research entry point, never a follow-up to a previously opened chat.
    if (startNewConversation) {
      activeChat.current=null;setChatId(null);chatTitle.current='New chat';
      chatMessages.current=[];setMessages([]);setNotes('');setSource(null);setEvidenceTab('sources');
    }
    const history=(startNewConversation?[]:chatMessages.current).slice(-12).map(m=>({role:m.role,content:m.content.slice(0,6000)}));
    setQuery('');setTab('chat');setError('');setBusy(true);
    const title=startNewConversation||chatTitle.current==='New chat'?question.trim().slice(0,100):chatTitle.current;
    const previous=startNewConversation?[]:chatMessages.current;
    const pending: Message[]=[...previous,{role:'user',content:question}];
    chatMessages.current=pending;setMessages(pending);
    let id=startNewConversation?null:activeChat.current;
    try {
      if (!id) {
        const created=await api<SavedChat>(`/workspaces/${target}/conversations`,{method:'POST',body:JSON.stringify({title,messages:pending})});
        id=created.id;activeChat.current=id;setChatId(id);chatTitle.current=title;
        setChats(old=>[{id:created.id,title,updated:created.updated},...old]);
      }
      const useConnected=connectedGmail||connectedProviders.length>0;
      const result=useConnected
        ? await api<Answer>(`/workspaces/${target}/connected-chat`,{method:'POST',body:JSON.stringify({question,history,document_ids:selected,include_gmail:connectedGmail,gmail_query:connectedGmailQuery,providers:connectedProviders})})
        : await api<Answer>(`/workspaces/${target}/chat`,{method:'POST',body:JSON.stringify({question,history,document_ids:selected})});
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
    if (!confirm(`Delete “${doc.name}” and its indexed content?`)) return;
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
      setTab(next); setSidebarOpen(false);
    });
  }

  async function addWorkspace(e: React.FormEvent) {
    e.preventDefault();
    try {const value = await api<Workspace>('/workspaces', {method:'POST', body:JSON.stringify({name:workspaceName})}); setWorkspaces(old => [...old, value]); setWid(value.id); setNewWorkspace(false); setWorkspaceName('');}
    catch(e) {setError((e as Error).message);}
  }
  async function removeWorkspace() {
    const target = workspaces.find(w=>w.id===deleteWorkspaceId);
    if (!target || target.name!==confirmWorkspaceName || deletingWorkspace || uploading || busy) return;
    setDeletingWorkspace(true);
    try {
      await api(`/workspaces/${target.id}`, {method:'DELETE',body:JSON.stringify({name:confirmWorkspaceName})});
      const remaining=workspaces.filter(w=>w.id!==target.id);
      setWorkspaces(remaining);
      if (wid===target.id) setWid(remaining[0]?.id||'');
      setDeleteWorkspaceId(null);setConfirmWorkspaceName('');setNewWorkspace(false);
      setNotice(`Workspace “${target.name}” deleted.`);
    } catch(e) {setError((e as Error).message);}
    finally {setDeletingWorkspace(false);}
  }
  async function refreshChats() {
    const target=wid;
    try {const items=await api<ChatSummary[]>(`/workspaces/${target}/conversations`);
      if(scope.current===target)setChats(items);
    } catch(e) {setError((e as Error).message);}
  }
  async function connectGmail(){
    setGmailBusy(true);setError('');
    try {
      const value=await api<{authorization_url:string}>(`/gmail/connect?wid=${encodeURIComponent(wid)}`);
      window.location.assign(value.authorization_url);
    }catch(e){setError((e as Error).message);setGmailBusy(false);}
  }
  useEffect(()=>{if((tab==='sources'||tab==='chat')&&wid){void refreshDrive();void api<{provider:string;connected:boolean;account:string|null}[]>(`/workspaces/${wid}/sources`).then(setSourceStatuses).catch(e=>setError((e as Error).message));}},[tab,wid]);
  async function refreshDrive(){
    if(!wid)return;
    try{setDriveStatus(await api<{connected:boolean;account:string|null;configured:boolean}>(`/workspaces/${wid}/drive/status`));}
    catch(e){setError((e as Error).message);}
  }
  async function connectDrive(){
    setDriveBusy(true);setError('');
    try{const result=await api<{authorization_url:string}>(`/drive/connect?wid=${encodeURIComponent(wid)}`);window.location.assign(result.authorization_url);}
    catch(e){setError((e as Error).message);setDriveBusy(false);}
  }
  async function disconnectDrive(){
    if(!window.confirm('Disconnect Google Drive from this workspace?'))return;
    setDriveBusy(true);setError('');
    try{await api(`/workspaces/${wid}/drive`,{method:'DELETE'});await refreshDrive();setDriveResults([]);}
    catch(e){setError((e as Error).message);}
    finally{setDriveBusy(false);}
  }
  async function searchDrive(){
    setDriveBusy(true);setError('');
    try{const data=await api<{results:{id:string;title:string;excerpt:string;url:string}[]}>(`/workspaces/${wid}/drive/search`,{method:'POST',body:JSON.stringify({query:driveQuery})});setDriveResults(data.results);}
    catch(e){setError((e as Error).message);}
    finally{setDriveBusy(false);}
  }
  async function refreshSourceStatuses(){
    if(!wid)return;
    try {setSourceStatuses(await api<{provider:string;connected:boolean;account:string|null}[]>(`/workspaces/${wid}/sources`));}
    catch(e){setError((e as Error).message);}
  }
  async function connectSource(){
    if(!sourceCredential.trim())return;
    setSourceBusy(true);setError('');
    try{
      await api(`/workspaces/${wid}/sources/${sourceProvider}`,{method:'POST',body:JSON.stringify({token:sourceCredential.trim()})});
      setSourceCredential('');await refreshSourceStatuses();
    }catch(e){setError((e as Error).message);}
    finally{setSourceBusy(false);}
  }
  async function disconnectSource(provider:string){
    if(!window.confirm(`Disconnect ${provider} from this workspace?`))return;
    setSourceBusy(true);setError('');
    try{await api(`/workspaces/${wid}/sources/${provider}`,{method:'DELETE'});await refreshSourceStatuses();setSourceResults([]);}
    catch(e){setError((e as Error).message);}
    finally{setSourceBusy(false);}
  }
  async function searchSource(){
    if(!sourceSearch.trim())return;
    setSourceBusy(true);setError('');
    try{
      const r=await api<{results:{provider:string;id:string;title:string;excerpt:string;url?:string}[]}>(`/workspaces/${wid}/sources/${sourceProvider}/search`,{method:'POST',body:JSON.stringify({query:sourceSearch.trim()})});
      setSourceResults(r.results);
    }catch(e){setError((e as Error).message);}
    finally{setSourceBusy(false);}
  }
  async function searchGmail(){
    setGmailBusy(true);setError('');setGmailSelected([]);setGmailMobileView('emails');
    try {
      const result=await api<{messages:GmailMessage[]}>(`/workspaces/${wid}/gmail/search`,
        {method:'POST',body:JSON.stringify({query:gmailQuery,limit:20})});
      setGmailMessages(result.messages);
    }catch(e){setError((e as Error).message);}
    finally{setGmailBusy(false);}
  }
  async function summarizeGmailQuery(){
    if(!gmailSummarizeQuery.trim())return;
    setGmailBusy(true);setGmailSummarizing(true);setError('');setGmailMobileView('summary');
    try{
      const result=await api<GmailSummary & {count:number;limited:boolean}>(`/workspaces/${wid}/gmail/summarize-query`,
        {method:'POST',body:JSON.stringify({query:gmailSummarizeQuery.trim(),limit:gmailQueryLimit})});
      setGmailSummary(result);setGmailSummaryIds([]);
      setGmailQuerySummaryLabel(`Query: ${gmailSummarizeQuery.trim()} · ${result.count} emails${result.limited?' (limit reached)':''}`);
      window.requestAnimationFrame(()=>gmailSummaryHeading.current?.focus());
    }catch(e){setError((e as Error).message);}
    finally{setGmailBusy(false);setGmailSummarizing(false);}
  }
  async function summarizeGmail(){
    if(!gmailSelected.length)return;
    const selectedForSummary=[...gmailSelected];
    setGmailBusy(true);setGmailSummarizing(true);setError('');setGmailMobileView('summary');
    try{
      const result=await api<GmailSummary>(`/workspaces/${wid}/gmail/summarize`,
        {method:'POST',body:JSON.stringify({message_ids:gmailSelected})});
      setGmailSummary(result);setGmailSummaryIds(selectedForSummary);setGmailQuerySummaryLabel('');
      window.requestAnimationFrame(()=>gmailSummaryHeading.current?.focus());
    }catch(e){setError((e as Error).message);}
    finally{setGmailBusy(false);setGmailSummarizing(false);}
  }
  async function disconnectGmail(){
    if(!window.confirm('Disconnect Gmail from this workspace?'))return;
    setGmailBusy(true);
    try{
      await api(`/workspaces/${wid}/gmail`,{method:'DELETE'});
      setGmailStatus({connected:false,email:null,configured:true});
      setGmailMessages([]);setGmailSelected([]);setGmailSummary(null);setGmailSummaryIds([]);
    }catch(e){setError((e as Error).message);}
    finally{setGmailBusy(false);}
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
    if (!result || !['ai', 'local_excerpts','connected'].includes(result.mode)) return [];
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
      return passage ? <button key={index} className="cite" onClick={() => passage.url ? window.open(passage.url,'_blank','noopener,noreferrer') : setSource(passage)} aria-label={`Open source ${match![1]}: ${passage.name}`}>{match![1]}</button> : part;
    }) : child);
  }
  function renderAnswer(result: Answer) {
    return <><div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{p:({children})=><p>{citationText(children,result.sources)}</p>,li:({children})=><li>{citationText(children,result.sources)}</li>}}>{result.answer}</ReactMarkdown></div>{visibleEvidence(result).length > 0 && <div className="source-chips">{visibleEvidence(result).map(({source:s,number}) => <button className="source-chip" key={s.chunk_id} onClick={() => s.url ? window.open(s.url,'_blank','noopener,noreferrer') : setSource(s)}><FileBadge name={s.name}/><span><b>{s.name}</b><small>{result.mode === 'local_excerpts' ? 'Search match' : 'Citation'} [{number}] · {s.location_type === 'page' ? 'Page' : 'Section'} {s.page}</small></span></button>)}</div>}</>;
  }
  async function copyConversation() {
    try {await navigator.clipboard.writeText(messages.map(m => `${m.role === 'user' ? 'You' : 'Atlas'}\n${m.content}`).join('\n\n')); setCopied(true); window.setTimeout(() => setCopied(false),2000);}
    catch {setError('Could not copy the conversation.');}
  }
  const uploadButton = <button className="btn primary" disabled={uploading || !wid} onClick={() => input.current?.click()}>{uploading ? <LoaderCircle className="spin"/> : <Plus/>}<span>{uploading ? 'Uploading…' : 'Add documents'}</span></button>;

  if (loading) return <div className="opening"><AtlasMark/><LoaderCircle className="spin"/><span>Opening your research workspace…</span></div>;
  if (!user) return <div className="auth-page"><header><div className="brand-row"><AtlasMark/><span>Atlas</span></div>{themeButton}</header><div className="auth-grid"><div className="auth-intro"><span className="eyebrow">YOUR RESEARCH WORKSPACE</span><h1>Your knowledge,<br/>a conversation away.</h1><p>Bring your documents together. Ask better questions. Follow every answer back to the evidence.</p><div className="auth-points"><span><FileText/>All your documents, one place</span><span><MessageSquare/>Questions with context</span><span><ShieldCheck/>A workspace of your own</span></div></div><form className="auth-form" onSubmit={authenticate}><h2>{register ? 'Create your workspace' : 'Welcome back'}</h2><p>{register ? 'Make room for your next discovery.' : 'Continue where your research left off.'}</p><label>Email address<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com"/></label><label>Password<input type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={10} maxLength={200} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 10 characters"/></label>{error && <div className="feedback error" role="alert">{error}</div>}<button className="btn primary" disabled={busy}>{busy ? <LoaderCircle className="spin"/> : <ArrowUpRight/>}{register ? 'Create account' : 'Sign in'}</button><div className="auth-switch">{register ? 'Already have an account?' : 'New to Atlas?'} <button type="button" onClick={()=>{setRegister(!register);setError('');}}>{register ? 'Sign in' : 'Create an account'}</button></div></form></div></div>;

  return <div className={`app atlas-v3 ${sidebarCollapsed ? 'collapsed' : ''}`}>
    <input ref={input} type="file" multiple accept=".pdf,.docx,.txt,.md" hidden onChange={e=>{if(e.target.files) void upload(e.target.files);}}/>
    {sidebarOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={()=>setSidebarOpen(false)}/>}
    <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
      <div className="brand-row"><AtlasMark/><span>Atlas</span><button className="sidebar-collapse" aria-label="Collapse sidebar" onClick={()=>{setSidebarCollapsed(true);setSidebarOpen(false);}}><PanelLeftClose/></button></div>
      <button className="workspace-btn" onClick={()=>setNewWorkspace(true)}><span className="ws-avatar">{workspace?.name[0]?.toUpperCase() || 'A'}</span><span><strong>{workspace?.name || 'Choose workspace'}</strong><small>{workspaces.length} workspace{workspaces.length===1?'':'s'}</small></span><ChevronDown/></button>
      <nav className="nav" aria-label="Main navigation">{([{id:'overview',label:'Home',icon:HomeIcon},{id:'chat',label:'Ask Atlas',icon:Search},{id:'documents',label:'Documents',icon:FileText},{id:'sources',label:'Sources',icon:FolderOpen}] as const).map(item=><button key={item.id} className={tab===item.id?'active':''} title={item.label} aria-current={tab===item.id?'page':undefined} onClick={()=>navigate(item.id)}><item.icon/><span>{item.label}</span></button>)}</nav>
      <div className="sidebar-research" aria-label="Recent conversations"><div className="section-label">RECENT CHATS</div>{chats.slice(0,4).map(item=><button key={item.id} className="workspace-stat" onClick={()=>void loadChat(item.id)} title={item.title}><MessageSquare/><span>{item.title}</span></button>)}<button className="workspace-stat" onClick={()=>{navigate('chat');void refreshChats();}}><Clock3/><span>All conversations ({chats.length})</span></button></div>
      <div className="bottom"><div className="usage" title={`${ready.length} documents ready · ${storage ? prettyBytes(storage) : '0 KB'} stored`}><span>Storage</span><strong>{storage ? prettyBytes(storage) : '0 KB'}</strong></div><div className="profile"><span className="avatar">{initials}</span><div><strong>{user.email.split('@')[0]}</strong><small>{user.email}</small></div><button className="icon-button" aria-label="Sign out" title="Sign out" onClick={()=>void signOut()}><LogOut/></button></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><button className="icon-button mobile" aria-label="Open menu" onClick={()=>setSidebarOpen(true)}><Menu/></button><button className="icon-button expand-sidebar" aria-label="Expand sidebar" onClick={()=>setSidebarCollapsed(false)}><PanelLeftOpen/></button><button className="global-search" onClick={()=>setSearchOpen(true)}><Search/><span>Search documents or ask a question…</span><kbd className="key">⌘ K</kbd></button><div className="top-actions">{themeButton}<button className="initials" aria-label="Manage workspaces" onClick={()=>setNewWorkspace(true)}>{initials}</button></div></header>
      <div className="content">
        {error && <div className="feedback error" role="alert"><AlertCircle/><span>{error}</span><button className="icon-button" aria-label="Dismiss error" onClick={()=>setError('')}><X/></button></div>}
        {notice && <div className="feedback" role="status"><CheckCircle2/><span>{notice}</span><button className="icon-button" aria-label="Dismiss notice" onClick={()=>setNotice('')}><X/></button></div>}
        {uploadProgress && <div className="feedback" role="status"><LoaderCircle className="spin"/><span>{uploadProgress}</span></div>}
        {uploadSummary && <div className="feedback" role="status"><Upload/><span>{uploadStatus || 'No files added'} <button className="text-button" onClick={()=>navigate('documents')}>View documents</button></span><button className="icon-button" aria-label="Dismiss upload status" onClick={()=>setUploadSummary(null)}><X/></button></div>}
        {!wid && <EmptyState icon={<FolderOpen/>} title="A new space for your knowledge" text="Create a workspace to add documents and begin researching." action={<button className="btn primary" onClick={()=>setNewWorkspace(true)}><Plus/>Create workspace</button>}/>}
        {wid && tab==='overview' && <section className="atlas-home">
          <div className="home-hero">
            <div className="home-hero-copy"><span className="section-kicker"><span/> RESEARCH WORKSPACE</span><h1>Find the answer.<br/><em>Know the source.</em></h1><p>Everything you've collected, connected, and learned. One thoughtful place to explore it.</p></div>
            <div className="hero-symbol" aria-hidden="true"><AtlasMark/></div>
          </div>
          <div className="home-prompt-panel"><div className="home-prompt-top"><Sparkles size={17}/><span>Ask Atlas</span><span className="home-prompt-hint">Search your knowledge</span></div>
            <form onSubmit={e=>{e.preventDefault();void ask(query,true);}}>
              <textarea aria-label="Ask Atlas" placeholder="What would you like to understand?" value={query} maxLength={4000} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(ready.length||connectedGmail||connectedProviders.length)void ask(query,true);}}}/>
              <div className="home-prompt-bottom"><div className="home-scope-summary"><FileText size={15}/>{ready.length} ready documents <span>·</span> <button type="button" onClick={()=>navigate('sources')}>Manage sources <ArrowUpRight size={13}/></button></div><button className="home-send" aria-label="Ask Atlas" disabled={busy||!query.trim()||(!ready.length&&!connectedGmail&&!connectedProviders.length)}>{busy?<LoaderCircle size={18} className="spin"/>:<ArrowUp size={18}/>}</button></div>
            </form></div>
          <div className="home-section-header"><div><span className="section-kicker">PICK UP WHERE YOU LEFT OFF</span><h2>Your workspace</h2></div><button className="text-action" onClick={()=>navigate('sources')}>Connected sources <ArrowUpRight size={15}/></button></div>
          <div className="home-activity-grid">
            <div className="home-activity-card"><div className="home-card-head"><div><span className="home-card-icon"><MessageSquare size={18}/></span><h3>Recent conversations</h3></div><button aria-label="Open conversations" onClick={()=>{navigate('chat');void refreshChats();}}><ArrowUpRight size={18}/></button></div>
              {chats.length?<div className="home-activity-list">{chats.slice(0,4).map(item=><button key={item.id} onClick={()=>void loadChat(item.id)}><span><strong>{item.title}</strong><small>{new Date(item.updated*1000).toLocaleDateString()}</small></span><ChevronRight size={16}/></button>)}</div>:<div className="home-card-empty"><p>Every good question starts a conversation.</p><button onClick={()=>{newChat();navigate('chat');}}>Start researching <ArrowUpRight size={14}/></button></div>}
            </div>
            <div className="home-activity-card"><div className="home-card-head"><div><span className="home-card-icon"><FileText size={18}/></span><h3>Recent documents</h3></div><button aria-label="Open document library" onClick={()=>navigate('documents')}><ArrowUpRight size={18}/></button></div>
              {docs.length?<div className="home-activity-list">{docs.slice(0,4).map(d=><button key={d.id} onClick={()=>void inspect(d)}><FileBadge name={d.name}/><span><strong>{d.name}</strong><small>{prettyBytes(d.size)} · {d.status==='ready'?'Ready to explore':d.status}</small></span><ChevronRight size={16}/></button>)}</div>:<div className="home-card-empty"><p>Add a document to start building your knowledge.</p>{uploadButton}</div>}
            </div>
          </div>
          <div className={`home-dropzone ${dragging?'dragging':''}`} onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);void upload(e.dataTransfer.files);}}>
            <span className="home-drop-icon"><Upload size={20}/></span><div><strong>Bring more knowledge into Atlas</strong><p>Drop PDF, DOCX, TXT or Markdown files. Up to {Math.round(user.max_file_bytes/1024/1024)} MB each.</p></div><button className="btn" disabled={uploading} onClick={()=>input.current?.click()}>Choose files</button>
          </div>
        </section>}
        {wid && tab==='chat' && <section>
          <div className="crumb">Ask Atlas<span>›</span><span className="crumb-title">{title}</span></div><div className="heading-row"><div className="research-heading"><span className="eyebrow">RESEARCH ASSISTANT</span><h1 title={title}>{title}</h1><p className="subtitle">Answers grounded in your documents, with evidence you can inspect.</p></div><div className="actions"><button className="btn" onClick={()=>setHistoryOpen(v=>!v)}><MessageSquare size={15}/>{historyOpen?'Hide history':'History'}</button><button className="btn hide-small" disabled={!messages.length} onClick={()=>void copyConversation()}>{copied?<Check/>:<Copy/>}{copied?'Copied':'Copy chat'}</button><button className="btn primary" disabled={busy} onClick={newChat}><Plus/><span>New chat</span></button></div></div>
          <div className="filters"><button className="filter" onClick={()=>setScopeOpen(true)}><FileText/>{selected.length?`${selected.length} selected documents`:'All documents'}<ChevronDown/></button><span className="research-mode"><i/>{user.mode==='ai'?'AI research':'Source search'} · {ready.length} ready documents</span></div>
          <div className="unified-sources"><span className="unified-sources-label">Search sources</span><label><input type="checkbox" checked readOnly/> Documents</label>
            <label><input type="checkbox" disabled={!gmailStatus?.connected} checked={connectedGmail} onChange={e=>setConnectedGmail(e.target.checked)}/> Gmail</label>
            {(['drive','github','notion','slack'] as const).map(p=><label key={p} title={p==='drive'?(driveStatus?.connected?'':'Connect Drive in Sources first'):(sourceStatuses.find(x=>x.provider===p)?.connected?'':'Connect this source in Sources first')}><input type="checkbox" disabled={p==='drive'?!driveStatus?.connected:!sourceStatuses.some(x=>x.provider===p&&x.connected)} checked={connectedProviders.includes(p)} onChange={e=>setConnectedProviders(old=>e.target.checked?[...old,p]:old.filter(x=>x!==p))}/>{p==='drive'?'Drive':p==='github'?'GitHub':p==='notion'?'Notion':'Slack'}</label>)}
            <button type="button" className="unified-source-manage" onClick={()=>navigate('sources')}>Manage connections <ArrowUpRight size={13}/></button>
          </div>
          {connectedGmail&&<div className="unified-gmail-scope"><label>Gmail search scope <input aria-label="Gmail search scope" value={connectedGmailQuery} onChange={e=>setConnectedGmailQuery(e.target.value)}/></label></div>}

          {user.mode !== 'ai' && <div className="feedback" role="status"><CircleHelp/><span><strong>Source search only.</strong> Atlas can find relevant passages, but it cannot write synthesized answers until an AI provider is configured. Set <code>AI_PROVIDER=openai</code> with <code>OPENAI_API_KEY</code>, or use <code>AI_PROVIDER=ollama</code>, then restart the API.</span></div>}
          <div className={`chat-workspace ${historyOpen?'history-visible':''}`}><aside className="chat-history"><div className="chat-history-header"><strong>Conversations</strong><button type="button" onClick={()=>void refreshChats()} title="Refresh saved conversations" aria-label="Refresh saved conversations"><RotateCcw size={15}/></button><button type="button" onClick={newChat} title="New conversation" aria-label="New conversation"><Plus size={16}/></button></div><div className="chat-history-list">{chats.map(item=><div className={`chat-history-item ${chatId===item.id?'current':''}`} key={item.id}><button className="chat-history-open" onClick={()=>void loadChat(item.id)} disabled={busy} title={item.title}><MessageSquare size={15}/><span>{item.title}</span></button><button className="chat-history-action" onClick={()=>void renameChat(item)} disabled={busy} aria-label={`Rename ${item.title}`} title="Rename">✎</button><button className="chat-history-action" onClick={()=>void deleteChat(item)} disabled={busy} aria-label={`Delete ${item.title}`} title="Delete"><Trash2 size={14}/></button></div>)}{!chats.length&&<p className="caption chat-history-empty">Your saved conversations will appear here.</p>}</div></aside><div className="research"><div className="chat-pane"><div className="thread" ref={chatThread}>
            {!messages.length && <div className="research-welcome"><span className="welcome-mark"><AtlasMark/></span><span className="eyebrow">ASK YOUR KNOWLEDGE</span><h2>Ask across your knowledge.</h2><p>{ready.length?'Find a specific detail, compare documents, or follow an idea back to its source.':'Add your first documents to explore them with Atlas.'}</p>{!ready.length?uploadButton:<div className="starter-questions">{prompts.map(p=><button key={p} onClick={()=>void ask(p)}>{p}<ArrowUpRight/></button>)}</div>}</div>}
            {messages.map((m,i)=>m.role==='user'?<div className="user-message" key={i}><div className="bubble-row"><span className="circle">{initials}</span><div className="bubble">{m.content}</div></div></div>:<div className="answer-row" key={i}><span className="assistant-mark">A</span><div className="answer"><div className="answer-head"><strong>Atlas</strong><span>{m.result?.mode==='ai'?'AI synthesis':m.result?.mode==='connected'?'Cross-source research':m.result?.mode==='local_excerpts'?'Source excerpts':'Evidence check'}</span></div>{m.result?renderAnswer(m.result):<p>{m.content}</p>}</div></div>)}
            {busy && <div className="thinking" role="status"><LoaderCircle className="spin"/><span>Reading the relevant evidence…</span></div>}<div ref={chatEnd}/>
          </div>{messages.length>0 && <div className="prompt-row">{['What are the key risks?','What should be built first?','Summarize the next steps'].map(p=><button key={p} disabled={busy || !ready.length} onClick={()=>void ask(p)}>{p}</button>)}</div>}
          <form className="composer" onSubmit={e=>{e.preventDefault();void ask();}}><button className="icon-button" type="button" aria-label="Add documents" disabled={uploading} onClick={()=>input.current?.click()}><Plus/></button><textarea aria-label="Your question" placeholder={messages.length?'Ask a follow-up question…':'Ask a question across your sources…'} rows={1} maxLength={4000} value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(ready.length||connectedGmail||connectedProviders.length)void ask();}}}/><button className="send" aria-label="Send question" disabled={busy || !query.trim() || (!ready.length&&!connectedGmail&&!connectedProviders.length)}>{busy?<LoaderCircle className="spin"/>:<ArrowUp/>}</button></form><p className="caption composer-caption">{messages.length?'Follow-ups use this conversation’s context. ':''}Review supporting passages before relying on an answer.</p></div>
          <aside className="evidence-panel"><div className="tabs" role="tablist" aria-label="Research evidence">{(['sources','notes','related'] as const).map(t=><button key={t} role="tab" aria-selected={evidenceTab===t} aria-controls={`evidence-${t}`} id={`tab-${t}`} className={evidenceTab===t?'selected':''} onClick={()=>setEvidenceTab(t)}>{t[0].toUpperCase()+t.slice(1)}{t==='sources'&&sources.length>0&&<span className="tab-count">{sources.length}</span>}</button>)}</div><div role="tabpanel" id={`evidence-${evidenceTab}`} aria-labelledby={`tab-${evidenceTab}`}>
            {evidenceTab==='sources' && (sources.length?evidenceItems.map(({source:s,number})=><button className="doc-item" key={s.chunk_id} onClick={()=>s.url?window.open(s.url,'_blank','noopener,noreferrer'):setSource(s)}><FileBadge name={s.name}/><span className="doc-item-info"><strong>{s.name}</strong><small>{latestAnswer?.mode==='local_excerpts'?'Search match':'Citation'} [{number}] · {s.location_type==='page'?'Page':'Section'} {s.page}</small></span><ChevronRight/></button>):<div className="evidence-placeholder"><FileText/><h3>Your evidence, alongside</h3><p>Only passages cited in the answer appear here. Ask a question to see its evidence.</p></div>)}
            {evidenceTab==='notes' && <div className="research-notes"><label htmlFor="research-notes">Your research notes</label><textarea id="research-notes" placeholder="Capture a finding, a question, or something to revisit…" value={notes} onChange={e=>setNotes(e.target.value)}/><p className="caption">Notes stay in this research session.</p><button className="btn" disabled={!notes.trim()} onClick={()=>{const url=URL.createObjectURL(new Blob([notes],{type:'text/plain'}));const a=document.createElement('a');a.href=url;a.download='atlas-research-notes.txt';a.click();URL.revokeObjectURL(url);}}><Download/>Export notes</button></div>}
            {evidenceTab==='related' && <><p className="panel-caption">Sources from earlier answers in this conversation.</p>{related.length?related.map(s=><button className="doc-item" key={s.document_id} onClick={()=>setSource(s)}><FileBadge name={s.name}/><span className="doc-item-info"><strong>{s.name}</strong><small>Previously referenced</small></span><ChevronRight/></button>):<div className="evidence-placeholder"><Layers3/><h3>Keep connecting the dots</h3><p>Earlier sources will collect here as your conversation explores more documents.</p></div>}</>}
          </div></aside></div></div>
        </section>}
        {wid && tab==='documents' && <section className="document-library-v3">
          <div className="crumb">Workspace<span>›</span>Library</div>
          <div className="library-intro"><div><span className="section-kicker">YOUR KNOWLEDGE LIBRARY</span><h1>Documents</h1><p>Every file you add becomes part of the answers Atlas can explain and reference.</p></div>{uploadButton}</div>
          <div className="library-stat-strip"><span><strong>{docs.length}</strong> Documents</span><span><strong>{ready.length}</strong> Ready to search</span><span><strong>{storage?prettyBytes(storage):'0 KB'}</strong> Storage used</span></div>
          <div className="library-workspace">
            <div className="library-workspace-heading"><div><h2>All documents</h2><p>Search and manage files in this workspace</p></div><span>{filtered.length} files</span></div>
            <div className="library-search-row"><label><Search size={17}/><input type="search" aria-label="Search documents" placeholder="Search your documents…" value={filter} onChange={e=>setFilter(e.target.value)}/></label></div>
            {renderDocuments(filtered)}
          </div>
          <div className={`home-dropzone ${dragging?'dragging':''}`} onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);void upload(e.dataTransfer.files);}}><span className="home-drop-icon"><Upload size={20}/></span><div><strong>Add documents to your library</strong><p>Drag in PDFs, Word files, plain text, or Markdown · max {Math.round(user.max_file_bytes/1024/1024)} MB each.</p></div><button className="btn" disabled={uploading} onClick={()=>input.current?.click()}>Browse files</button></div>
        </section>}
        {wid && tab==='sources' && <section className="connected-page">
          {sourceManage!=='gmail' && <div className="sources-overview">
          <div className="crumb">Workspace<span>›</span>Sources</div><div className="heading-row"><div><span className="eyebrow">YOUR INTEGRATIONS</span><h1>Connected sources</h1><p className="subtitle">Connect external services to your research workspace. Access stays read-only.</p></div>
          <button className="btn" onClick={()=>void refreshSourceStatuses()}>Refresh connections</button></div>
          <div className="integration-overview"><div><h2>Your integrations</h2><p>Choose a service to connect or manage its access.</p></div><span>{[gmailStatus?.connected,driveStatus?.connected,...sourceStatuses.map(x=>x.connected)].filter(Boolean).length} connected</span></div>
          <div className="integrations-grid">
            <IntegrationTile name="Gmail" description="Search conversations and summarize email." icon={<Mail size={23}/>} connected={!!gmailStatus?.connected} account={gmailStatus?.email} onClick={()=>{setSourceManage('gmail');window.scrollTo({top:0,behavior:'instant'});}}/>
            <IntegrationTile name="Google Drive" description="Explore documents and cloud files." icon={<HardDrive size={23}/>} connected={!!driveStatus?.connected} account={driveStatus?.account} onClick={()=>setSourceManage('drive')}/>
            <IntegrationTile name="GitHub" description="Find issues, pull requests and decisions." icon={<Github size={23}/>} connected={!!sourceStatuses.find(x=>x.provider==='github')?.connected} account={sourceStatuses.find(x=>x.provider==='github')?.account} onClick={()=>{setSourceProvider('github');setSourceManage('github');setSourceResults([]);}}/>
            <IntegrationTile name="Notion" description="Search shared pages and knowledge." icon={<NotebookPen size={23}/>} connected={!!sourceStatuses.find(x=>x.provider==='notion')?.connected} account={sourceStatuses.find(x=>x.provider==='notion')?.account} onClick={()=>{setSourceProvider('notion');setSourceManage('notion');setSourceResults([]);}}/>
            <IntegrationTile name="Slack" description="Find team conversations and updates." icon={<Hash size={23}/>} connected={!!sourceStatuses.find(x=>x.provider==='slack')?.connected} account={sourceStatuses.find(x=>x.provider==='slack')?.account} onClick={()=>{setSourceProvider('slack');setSourceManage('slack');setSourceResults([]);}}/>
          </div>
          </div>}
        {sourceManage==='gmail' && <section className="gmail-page gmail-integrated">
          <div className="gmail-integrated-back"><button className="btn" type="button" onClick={()=>{setSourceManage(null);window.scrollTo({top:0,behavior:'instant'});}}>← All sources</button></div>
          <div className="heading-row"><div><h1>Gmail</h1><p className="subtitle">Find messages and summarize only the emails you select.</p></div>
            {gmailStatus?.connected && <button className="btn" disabled={gmailBusy} onClick={()=>void disconnectGmail()}>Disconnect</button>}
          </div>
          <div className="gmail-intro">
            <div><strong>{gmailStatus?.connected?gmailStatus.email:'Connect your Gmail account'}</strong>
              <p className="caption">{gmailStatus?.connected?'Read-only access · emails are fetched on demand, not added to your document library.':'Atlas requests read-only Gmail permission. No emails are sent, edited, or deleted.'}</p></div>
            {!gmailStatus?.connected&&<button className="btn primary" disabled={gmailBusy} onClick={()=>void connectGmail()}>Connect Gmail <ArrowUpRight/></button>}
          </div>
          {gmailStatus?.connected && <>
            <form className="gmail-search" onSubmit={e=>{e.preventDefault();void searchGmail();}}>
              <label htmlFor="gmail-query">Gmail search</label>
              <div><input id="gmail-query" value={gmailQuery} onChange={e=>setGmailQuery(e.target.value)} placeholder="in:inbox newer_than:30d"/>
                <button className="btn primary" disabled={gmailBusy}>{gmailBusy?'Searching…':'Find emails'}</button></div>
            </form>
            <form className="gmail-query-summary" onSubmit={e=>{e.preventDefault();void summarizeGmailQuery();}}>
              <div className="gmail-query-summary-title"><strong>Summarize by search</strong><span className="caption">Search your connected mailbox, not just the messages loaded below.</span></div>
              <div className="gmail-query-presets">
                <button type="button" className="btn" onClick={()=>setGmailSummarizeQuery('subject:(offer OR discount OR sale) newer_than:30d')}>Offers & discounts</button>
                <button type="button" className="btn" onClick={()=>setGmailSummarizeQuery('category:promotions newer_than:30d')}>Promotions</button>
                <button type="button" className="btn" onClick={()=>setGmailSummarizeQuery('is:unread newer_than:7d')}>Unread this week</button>
              </div>
              <div className="gmail-query-controls">
                <input aria-label="Gmail query to summarize" value={gmailSummarizeQuery} onChange={e=>setGmailSummarizeQuery(e.target.value)} placeholder="from:someone@gmail.com or subject:offer"/>
                <select aria-label="Maximum matching emails" value={gmailQueryLimit} onChange={e=>setGmailQueryLimit(Number(e.target.value))}>
                  <option value={15}>Up to 15</option><option value={30}>Up to 30</option><option value={60}>Up to 60</option>
                </select>
                <button className="btn primary" disabled={gmailBusy||!gmailSummarizeQuery.trim()} type="submit">Summarize matches</button>
              </div>
              <p className="caption">Examples: from:sender@gmail.com, subject:offer, category:promotions. Results are capped per run; no background mailbox indexing.</p>
            </form>
            <div className="gmail-mobile-tabs" role="group" aria-label="Gmail view">
              <button type="button" aria-pressed={gmailMobileView==='emails'} className={gmailMobileView==='emails'?'active':''} onClick={()=>setGmailMobileView('emails')}>Emails</button>
              <button type="button" aria-pressed={gmailMobileView==='summary'} className={gmailMobileView==='summary'?'active':''} onClick={()=>setGmailMobileView('summary')}>Summary{gmailSummary?' • Ready':''}</button>
            </div>
            <div className="gmail-workspace">
              <div className={`gmail-mail-panel ${gmailMobileView==='emails'?'mobile-active':''}`}>
                <div className="gmail-panel-head"><strong>Emails</strong><span className="caption">{gmailMessages.length} results</span></div>
                <div className="gmail-actions"><div className="gmail-selection"><span>{gmailSelected.length} selected · maximum 15</span>
                  <button type="button" className="btn" disabled={gmailBusy||!gmailMessages.length} onClick={()=>setGmailSelected(gmailMessages.slice(0,15).map(m=>m.id))}>Select all{gmailMessages.length>15?' (first 15)':''}</button>
                  <button type="button" className="btn" disabled={gmailBusy||!gmailSelected.length} onClick={()=>setGmailSelected([])}>Deselect</button></div>
                </div>
                <div className="gmail-list">{gmailMessages.map(m=><div className="gmail-item" key={m.id}>
                  <input aria-label={`Select ${m.subject}`} type="checkbox" checked={gmailSelected.includes(m.id)} disabled={gmailBusy} onChange={e=>setGmailSelected(old=>e.target.checked?old.length<15?[...old,m.id]:old:old.filter(x=>x!==m.id))}/>
                  <button type="button" className="gmail-message-preview" onClick={()=>setGmailPreview(m)}><strong>{m.subject}</strong><small>{m.sender} · {m.date}</small><span>{m.snippet}</span></button>
                  <a href={m.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${m.subject} in Gmail`}><ArrowUpRight size={15}/></a>
                </div>)}</div>
                <div className="gmail-mail-footer"><button className="btn primary" disabled={gmailBusy||!gmailSelected.length} onClick={()=>void summarizeGmail()}>{gmailSummarizing?'Generating summary…':'Summarize selected'}</button></div>
              </div>
              <section className={`gmail-summary-panel ${gmailMobileView==='summary'?'mobile-active':''}`} aria-label="Email summary" aria-busy={gmailSummarizing}>
                <div className="gmail-panel-head"><h2 ref={gmailSummaryHeading} tabIndex={-1}>AI Summary</h2>
                  {gmailSummary&&!gmailSummarizing&&<button type="button" className="icon-button" aria-label="Copy email summary" title="Copy summary" onClick={()=>void navigator.clipboard.writeText(gmailSummary.summary).then(()=>setNotice('Summary copied.')).catch(()=>setError('Unable to copy summary.'))}><Copy size={16}/></button>}</div>
                {gmailSummarizing?<div className="gmail-summary-state" role="status" aria-live="polite"><LoaderCircle className="spin"/><strong>Reading selected emails…</strong><p>Atlas is preparing a cited summary for {gmailSelected.length} messages.</p></div>:
                gmailSummary?<div className="gmail-summary-content">
                  {gmailQuerySummaryLabel?<p className="gmail-ready">{gmailQuerySummaryLabel}</p>:gmailSelected.length!==gmailSummaryIds.length||gmailSelected.some(id=>!gmailSummaryIds.includes(id))?<p className="gmail-stale">Showing the previous summary. Your selection has changed; regenerate to summarize the current emails.</p>:<p className="gmail-ready"><CheckCircle2 size={15}/> Summary ready · {gmailSummaryIds.length} messages</p>}
                  <div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{gmailSummary.summary}</ReactMarkdown></div>
                  <div className="gmail-summary-sources"><h3>Sources</h3>{gmailSummary.sources.map(item=><div className="gmail-source" key={item.id}><button type="button" onClick={()=>{const m=gmailMessages.find(msg=>msg.id===item.id);if(m)setGmailPreview(m);else window.open(item.url,'_blank','noopener,noreferrer');}}>[{item.number}] {item.subject}</button><a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${item.subject} in Gmail`}><ArrowUpRight size={14}/></a></div>)}</div>
                  <div className="gmail-summary-footer"><button className="btn" disabled={gmailBusy||!gmailSelected.length} onClick={()=>void summarizeGmail()}><RotateCcw size={15}/> Regenerate</button><button className="btn" onClick={()=>{setGmailSummary(null);setGmailSummaryIds([]);setGmailMobileView('emails');}}>New summary</button></div>
                </div>:<div className="gmail-summary-state"><FileText size={25}/><strong>Summary will appear here</strong><p>Select emails on the left, then choose Summarize selected. Original messages remain available as sources.</p></div>}
              </section>
            </div>
            {gmailPreview&&<div className="gmail-preview-overlay" role="presentation" onClick={()=>setGmailPreview(null)}><aside role="dialog" aria-modal="true" aria-label="Email preview" className="gmail-preview-drawer" onClick={e=>e.stopPropagation()}>
              <div className="gmail-preview-head"><h2>{gmailPreview.subject}</h2><button type="button" className="icon-button" aria-label="Close email preview" onClick={()=>setGmailPreview(null)}><X/></button></div>
              <p className="caption">{gmailPreview.sender} · {gmailPreview.date}</p>
              <div className="gmail-preview-body">{gmailPreview.body||gmailPreview.snippet||'No readable plain-text content available.'}</div>
              <a className="btn" target="_blank" rel="noopener noreferrer" href={gmailPreview.url}>Open original in Gmail <ArrowUpRight size={15}/></a>
            </aside></div>}
          </>}
        </section>}

          {sourceManage&&sourceManage!=='gmail'&&<div className="source-dialog-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setSourceManage(null)}}><div className="source-dialog" role="dialog" aria-modal="true" aria-label="Manage source connection"><button className="source-dialog-close" aria-label="Close connection details" onClick={()=>setSourceManage(null)}><X size={18}/></button>
          {sourceManage==='drive'&&<div className="connected-card" id="drive-connection">
            <h2>Google Drive</h2>
            <p className="caption">Authorize read-only access to browse and search Drive. Atlas fetches selected content on demand.</p>
            {driveStatus?.connected?<><p className="caption">Connected: {driveStatus.account}</p>
              <div className="source-search-controls"><input className="connected-field" value={driveQuery} onChange={e=>setDriveQuery(e.target.value)} placeholder="Search Drive file names or text" aria-label="Search Drive"/><button className="btn" disabled={driveBusy} onClick={()=>void searchDrive()}>Search Drive</button><button className="btn" disabled={driveBusy} onClick={()=>void disconnectDrive()}>Disconnect</button></div>
              {driveResults.map(x=><div className="connected-evidence" key={x.id}><strong>{x.title}</strong><p>{x.excerpt}</p><a href={x.url} target="_blank" rel="noopener noreferrer">Open in Drive <ArrowUpRight size={14}/></a></div>)}
            </>:<button className="btn primary" disabled={driveBusy||!driveStatus?.configured} onClick={()=>void connectDrive()}>Connect Google Drive</button>}
            {!driveStatus?.configured&&<p className="caption">Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_DRIVE_REDIRECT_URI on the server to enable Drive.</p>}
          </div>}
          {sourceManage!==null&&sourceManage!=='drive'&&<div className="connected-card">
            <h2>{sourceProvider==='github'?'GitHub':sourceProvider==='notion'?'Notion':'Slack'} connection</h2>
            <p className="caption">Provide a read-only provider-issued token. Atlas validates it and stores it encrypted on the server. This setup is not yet one-click OAuth.</p>
            <form onSubmit={e=>{e.preventDefault();void connectSource()}}>
              <input className="connected-field" type="password" autoComplete="off" aria-label="Provider access token" value={sourceCredential} onChange={e=>setSourceCredential(e.target.value)} placeholder="Paste read-only access token"/>
              <button type="submit" className="btn primary" disabled={sourceBusy||!sourceCredential.trim()}>{sourceBusy?'Connecting…':'Connect account'}</button>
            </form>
            {sourceStatuses.some(x=>x.provider===sourceProvider&&x.connected)&&<>
              <div className="source-search-controls"><input className="connected-field" value={sourceSearch} onChange={e=>setSourceSearch(e.target.value)} placeholder={sourceProvider==='github'?'Search issues and PRs':sourceProvider==='notion'?'Search page titles':'Search messages'} aria-label="Search connected provider"/>
              <button className="btn" disabled={sourceBusy||!sourceSearch.trim()} onClick={()=>void searchSource()}>Search</button>
              <button className="btn" disabled={sourceBusy} onClick={()=>void disconnectSource(sourceProvider)}>Disconnect</button></div>
              {sourceResults.map(x=><div className="connected-evidence" key={x.id}><strong>{x.title}</strong><p>{x.excerpt}</p>{x.url&&<a href={x.url} target="_blank" rel="noopener noreferrer">Open source <ArrowUpRight size={14}/></a>}</div>)}
            </>}
          </div>}
          </div></div>}
          <p className="caption">All connections are scoped to this workspace. Source content is accessed on demand; you can disconnect accounts at any time.</p>
        </section>}
      </div>
    </main>
    {searchOpen && <Dialog title="Search your workspace" onClose={()=>setSearchOpen(false)} className="search-dialog"><div className="modal-search"><Search/><input autoFocus aria-label="Search your workspace" placeholder="Find a document or ask a question…" value={globalQuery} onChange={e=>setGlobalQuery(e.target.value)}/></div>{globalQuery.trim()&&<button className="search-question" disabled={busy || !ready.length} onClick={()=>{setSearchOpen(false);void ask(globalQuery);setGlobalQuery('');}}><Sparkles/><span>Ask Atlas: {globalQuery}</span><ArrowUpRight/></button>}<div className="search-results">{docs.filter(d=>d.name.toLowerCase().includes(globalQuery.toLowerCase())).slice(0,12).map(d=><button className="doc-item" key={d.id} onClick={()=>{setSearchOpen(false);void inspect(d);}}><FileBadge name={d.name}/><span className="doc-item-info"><strong>{d.name}</strong><small>{prettyBytes(d.size)} · {d.chunk_count} passages</small></span><ChevronRight/></button>)}{!docs.some(d=>d.name.toLowerCase().includes(globalQuery.toLowerCase()))&&<p className="evidence-empty">No matching documents.</p>}</div></Dialog>}
    {scopeOpen && <Dialog title="Choose your sources" onClose={()=>setScopeOpen(false)}><p className="dialog-intro">Ask across all ready documents, or choose a focused set.</p><button className="btn" onClick={()=>setSelected([])}><Layers3/>Use all documents</button><div className="scope-list">{ready.map(d=><label key={d.id}><input type="checkbox" checked={selected.includes(d.id)} onChange={e=>setSelected(old=>e.target.checked?[...old,d.id]:old.filter(id=>id!==d.id))}/><FileBadge name={d.name}/><span>{d.name}</span></label>)}</div><div className="dialog-footer"><span className="caption">{selected.length?`${selected.length} selected`:'All ready documents included'}</span><button className="btn primary" onClick={()=>setScopeOpen(false)}>Done<Check/></button></div></Dialog>}
    {newWorkspace && <Dialog title="Your workspaces" onClose={()=>{setNewWorkspace(false);setDeleteWorkspaceId(null);}}><p className="dialog-intro">Manage your workspaces and their saved conversations.</p><div className="workspace-list">{workspaces.map(w=><div className="workspace-manage-row" key={w.id}><button className={w.id===wid?'selected':''} disabled={busy || uploading || deletingWorkspace} onClick={()=>{setWid(w.id);setNewWorkspace(false);}}><span className="ws-avatar">{w.name[0].toUpperCase()}</span><strong>{w.name}</strong>{w.id===wid?<Check/>:<ChevronRight/>}</button><button className="workspace-delete" type="button" title={`Delete ${w.name}`} aria-label={`Delete workspace ${w.name}`} onClick={()=>{setDeleteWorkspaceId(w.id);setConfirmWorkspaceName('');}}><Trash2 size={16}/></button></div>)}</div>{deleteWorkspaceId && <div className="workspace-delete-confirm" role="group" aria-label="Confirm workspace deletion"><strong>Delete “{workspaces.find(w=>w.id===deleteWorkspaceId)?.name}”?</strong><p>This permanently deletes its documents, indexed passages, and saved chats. Type the workspace name to confirm.</p><input aria-label="Type workspace name to confirm" autoComplete="off" value={confirmWorkspaceName} onChange={e=>setConfirmWorkspaceName(e.target.value)} placeholder="Exact workspace name"/><div className="dialog-actions"><button className="btn" type="button" onClick={()=>setDeleteWorkspaceId(null)}>Cancel</button><button className="btn danger" type="button" disabled={deletingWorkspace || busy || uploading || confirmWorkspaceName!==workspaces.find(w=>w.id===deleteWorkspaceId)?.name} onClick={()=>void removeWorkspace()}>{deletingWorkspace?'Deleting…':'Delete workspace'}</button></div></div>}<form className="workspace-form" onSubmit={addWorkspace}><label>New workspace<input required maxLength={100} value={workspaceName} onChange={e=>setWorkspaceName(e.target.value)} placeholder="e.g. Product research"/></label><button className="btn primary"><Plus/>Create workspace</button></form></Dialog>}
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
