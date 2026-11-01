'use client';
import {ArrowUp,LoaderCircle,Plus} from 'lucide-react';

export function ResearchComposer({query,onChange,onSubmit,onUpload,uploading,busy,hasAskSources,hasMessages}:{query:string;onChange:(q:string)=>void;onSubmit:()=>void;onUpload:()=>void;uploading:boolean;busy:boolean;hasAskSources:boolean;hasMessages:boolean}) {
return <form className="composer research-composer-v2" onSubmit={e=>{e.preventDefault();onSubmit();}}><button className="icon-button" type="button" aria-label="Add documents" disabled={uploading} onClick={onUpload}><Plus/></button><textarea aria-label="Your question" aria-describedby="research-composer-help" placeholder={hasMessages?'Ask a follow-up question…':'Ask a question across your sources…'} rows={1} maxLength={4000} value={query} onChange={e=>onChange(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();if(hasAskSources&&!busy&&query.trim())onSubmit();}}}/><button className="send" aria-label="Send question" disabled={busy || !query.trim() || !hasAskSources}>{busy?<LoaderCircle className="spin"/>:<ArrowUp/>}</button></form>;
}
