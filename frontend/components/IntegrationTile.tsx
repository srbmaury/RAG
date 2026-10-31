'use client';
import type {ReactNode} from 'react';
import {ArrowUpRight,CheckCircle2} from 'lucide-react';

type Props={name:string;description:string;connected?:boolean;account?:string|null;icon:ReactNode;onClick:()=>void;disabled?:boolean};
export function IntegrationTile({name,description,connected,account,icon,onClick,disabled}:Props){
  return <button type="button" className="integration-tile" onClick={onClick} disabled={disabled}>
    <span className="integration-tile-top"><span className="integration-tile-icon">{icon}</span><ArrowUpRight size={17} className="integration-tile-arrow"/></span>
    <span className="integration-tile-name">{name}</span>
    <span className="integration-tile-description">{description}</span>
    <span className={`integration-tile-status ${connected?'connected':''}`}>{connected?<><CheckCircle2 size={14}/> {account||'Connected'}</>:<><span className="integration-status-dot"/>Not connected</>}</span>
  </button>;
}
