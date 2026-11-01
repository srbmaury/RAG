'use client';
import {type ReactNode} from 'react';
import {Sparkles,FileText,ArrowUpRight,LoaderCircle,ArrowUp,MessageSquare,ChevronRight,Upload} from 'lucide-react';
import type {Doc,ChatSummary} from '../../lib/types';
import {AtlasMark,FileBadge} from '../ui/WorkspacePrimitives';

export function HomeView({query,onQueryChange,onAsk,hasAskSources,includeDocuments,readyCount,busy,chats,docs,onOpenSources,onOpenConversations,onOpenConversation,onStartChat,onOpenDocuments,onInspectDocument,uploadButton,dragging,onDragging,onDrop,maxSizeMB,uploading,onBrowse,formatSize}:{query:string;onQueryChange:(value:string)=>void;onAsk:()=>void;hasAskSources:boolean;includeDocuments:boolean;readyCount:number;busy:boolean;chats:ChatSummary[];docs:Doc[];onOpenSources:()=>void;onOpenConversations:()=>void;onOpenConversation:(id:string)=>void;onStartChat:()=>void;onOpenDocuments:()=>void;onInspectDocument:(doc:Doc)=>void;uploadButton:ReactNode;dragging:boolean;onDragging:(value:boolean)=>void;onDrop:(files:FileList)=>void;maxSizeMB:number;uploading:boolean;onBrowse:()=>void;formatSize:(value:number)=>string}){
return <section className="atlas-home">
          <div className="home-hero home-hero-focused">
            <div className="home-hero-copy"><span className="section-kicker"><span/> RESEARCH WORKSPACE</span><h1>What would you like<br/><em>to explore?</em></h1><p>Ask across your documents and connected sources. Every answer stays connected to its evidence.</p></div>
            
          </div>
          <div className="home-prompt-panel"><div className="home-prompt-top"><Sparkles size={17}/><span>Ask Atlas</span><span className="home-prompt-hint">Search your knowledge</span></div>
            <form onSubmit={e=>{e.preventDefault();onAsk();}}>
              <textarea aria-label="Ask Atlas" placeholder="What would you like to understand?" value={query} maxLength={4000} onChange={e=>onQueryChange(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(hasAskSources)onAsk();}}}/>
              <div className="home-prompt-bottom"><div className="home-scope-summary"><FileText size={15}/>{includeDocuments?`${readyCount} ready documents`:'No documents selected'} <span>·</span> <button type="button" onClick={()=>onOpenSources()}>Manage sources <ArrowUpRight size={13}/></button></div><button className="home-send" aria-label="Ask Atlas" disabled={busy||!query.trim()||!hasAskSources}>{busy?<LoaderCircle size={18} className="spin"/>:<ArrowUp size={18}/>}</button></div>
            </form></div>
          <div className="home-section-header"><div><span className="section-kicker">CONTINUE YOUR WORK</span><h2>Pick up where you left off</h2></div><button className="text-action" onClick={()=>onOpenSources()}>Connected sources <ArrowUpRight size={15}/></button></div>
          <div className="home-activity-grid">
            <div className="home-activity-card"><div className="home-card-head"><div><span className="home-card-icon"><MessageSquare size={18}/></span><h3>Recent conversations</h3></div><button aria-label="Open conversations" onClick={()=>{onOpenConversations();}}><ArrowUpRight size={18}/></button></div>
              {chats.length?<div className="home-activity-list">{chats.slice(0,4).map(item=><button key={item.id} onClick={()=>onOpenConversation(item.id)}><span><strong>{item.title}</strong><small>{new Date(item.updated*1000).toLocaleDateString()}</small></span><ChevronRight size={16}/></button>)}</div>:<div className="home-card-empty"><p>Every good question starts a conversation.</p><button onClick={()=>{onStartChat();}}>Start researching <ArrowUpRight size={14}/></button></div>}
            </div>
            <div className="home-activity-card"><div className="home-card-head"><div><span className="home-card-icon"><FileText size={18}/></span><h3>Recent documents</h3></div><button aria-label="Open document library" onClick={()=>onOpenDocuments()}><ArrowUpRight size={18}/></button></div>
              {docs.length?<div className="home-activity-list">{docs.slice(0,4).map(d=><button key={d.id} onClick={()=>onInspectDocument(d)}><FileBadge name={d.name}/><span><strong>{d.name}</strong><small>{formatSize(d.size)} · {d.status==='ready'?'Ready to explore':d.status}</small></span><ChevronRight size={16}/></button>)}</div>:<div className="home-card-empty"><p>Add a document to start building your knowledge.</p>{uploadButton}</div>}
            </div>
          </div>
          <div className={`home-dropzone ${dragging?'dragging':''}`} onDragOver={e=>{e.preventDefault();onDragging(true);}} onDragLeave={()=>onDragging(false)} onDrop={e=>{e.preventDefault();onDragging(false);onDrop(e.dataTransfer.files);}}>
            <span className="home-drop-icon"><Upload size={20}/></span><div><strong>Bring more knowledge into Atlas</strong><p>Drop PDF, DOCX, TXT, Markdown, CSV, JSON or HTML files. Up to {maxSizeMB} MB each.</p></div><button className="btn" disabled={uploading} onClick={()=>onBrowse()}>Choose files</button>
          </div>
        </section>;
}
