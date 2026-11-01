'use client';
import {useEffect,useRef,type ReactNode} from 'react';
import {LoaderCircle,Check,AlertCircle,X} from 'lucide-react';
export function AtlasMark() {return <span className="mark" aria-hidden="true"><svg viewBox="0 0 30 30"><path d="M9 3c2 0 4 2 5.2 5l5.6 13c1 2.5-.2 5.2-2.9 6-2.5.7-4.6-.5-5.6-3L5.9 11C4.6 7.7 6 3 9 3Z"/><path d="M21 7c2.4 0 4 3.4 4 6l-1 10c-.3 3.5-4 5-6.5 3.2-1.8-1.2-2-3-1.3-5l3.1-10C19.8 9 20 7 21 7Z" fill="currentColor"/></svg></span>;}
export function FileBadge({name}: {name:string}) {
  const knownExtensions=new Set(['pdf','docx','doc','txt','md','csv','json','html','htm','xlsx','xls','pptx','ppt']);
  const suffix=name.split('.').pop()?.toLowerCase()||'';
  const extension=knownExtensions.has(suffix)?suffix:'source';
  return <span className={`file ${extension}`} aria-hidden="true">{extension==='source'?'SRC':extension.toUpperCase()}</span>;
}
export function Status({status}: {status:string}) {return <span className={`status status-${status}`}>{['queued','processing'].includes(status)?<LoaderCircle className="spin"/>:status==='ready'?<Check/>:status==='failed'?<AlertCircle/>:null}{status==='ready'?'Ready':status[0].toUpperCase()+status.slice(1)}</span>;}
export function EmptyState({icon,title,text,action}: {icon:ReactNode;title:string;text:string;action?:ReactNode}) {return <div className="empty-state"><span>{icon}</span><h3>{title}</h3><p>{text}</p>{action}</div>;}
export function Dialog({title,onClose,children,className=''}: {title:string;onClose:()=>void;children:ReactNode;className?:string}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{ref.current?.showModal();const dialog=ref.current;dialog?.querySelector<HTMLElement>('[data-autofocus]')?.focus();return()=>dialog?.close();},[]);
  return <dialog ref={ref} className={`dialog ${className}`} aria-label={title} onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div className="dialog-heading"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X/></button></div>{children}</dialog>;
}
