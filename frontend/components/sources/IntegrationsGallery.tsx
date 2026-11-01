'use client';
import {Mail,HardDrive,Github,NotebookPen,Hash} from 'lucide-react';
import {IntegrationTile} from '../IntegrationTile';
type Health={healthy:boolean;matches:number|null;error:string|null;checked_at:number};
type SourceStatus={provider:string;connected:boolean;account:string|null};
export function IntegrationsGallery({gmailStatus,driveStatus,sourceStatuses,sourceChecks,onOpen}:{gmailStatus:{connected:boolean;email:string|null}|null;driveStatus:{connected:boolean;account:string|null}|null;sourceStatuses:SourceStatus[];sourceChecks:Record<string,Health>;onOpen:(provider:string)=>void}){
return <>
<div className="integration-overview"><div><h2>Your integrations</h2><p>Choose a service to connect or manage its access.</p></div><span>{[gmailStatus?.connected,driveStatus?.connected,...sourceStatuses.map(x=>x.connected)].filter(Boolean).length} connected</span></div>
          <div className="integrations-grid">
            <IntegrationTile name="Gmail" description="Search conversations and summarize email." icon={<Mail size={23}/>} connected={!!gmailStatus?.connected} account={gmailStatus?.email} health={sourceChecks.gmail} onClick={()=>{onOpen('gmail');}}/>
            <IntegrationTile name="Google Drive" description="Explore documents and cloud files." icon={<HardDrive size={23}/>} connected={!!driveStatus?.connected} account={driveStatus?.account} health={sourceChecks.drive} onClick={()=>onOpen('drive')}/>
            <IntegrationTile name="GitHub" description="Find issues, pull requests and decisions." icon={<Github size={23}/>} connected={!!sourceStatuses.find(x=>x.provider==='github')?.connected} account={sourceStatuses.find(x=>x.provider==='github')?.account} health={sourceChecks.github} onClick={()=>{onOpen('github');}}/>
            <IntegrationTile name="Notion" description="Search shared pages and knowledge." icon={<NotebookPen size={23}/>} connected={!!sourceStatuses.find(x=>x.provider==='notion')?.connected} account={sourceStatuses.find(x=>x.provider==='notion')?.account} health={sourceChecks.notion} onClick={()=>{onOpen('notion');}}/>
            <IntegrationTile name="Slack" description="Find team conversations and updates." icon={<Hash size={23}/>} connected={!!sourceStatuses.find(x=>x.provider==='slack')?.connected} account={sourceStatuses.find(x=>x.provider==='slack')?.account} health={sourceChecks.slack} onClick={()=>{onOpen('slack');}}/>
          </div>
</>;
}
