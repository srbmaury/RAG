'use client';
import {ArrowUpRight} from 'lucide-react';
import {Dialog} from '../ui/WorkspacePrimitives';
import {useSourceConnections} from '../../hooks/useSourceConnections';
type State=ReturnType<typeof useSourceConnections>;
export function SourceConnectionDialog({state,onClose,onSearchDrive,onDisconnectDrive,onConnectDrive,onConnectSource,onSearchSource,onDisconnectSource}:{state:State;onClose:()=>void;onSearchDrive:()=>void;onDisconnectDrive:()=>void;onConnectDrive:()=>void;onConnectSource:()=>void;onSearchSource:()=>void;onDisconnectSource:(provider:string)=>void}){
const {driveStatus,driveQuery,setDriveQuery,driveResults,driveBusy,sourceStatuses,sourceManage,sourceProvider,sourceCredential,setSourceCredential,sourceSearch,setSourceSearch,sourceResults,sourceBusy}=state;
return <>{sourceManage&&sourceManage!=='gmail'&&<Dialog title="Manage source connection" onClose={()=>{onClose();}} className="source-dialog">
          {sourceManage==='drive'&&<div className="connected-card" id="drive-connection">
            <h2>Google Drive</h2>
            <p className="caption">Authorize read-only access to browse and search Drive. Atlas fetches selected content on demand.</p>
            {driveStatus?.connected?<><p className="caption">Connected: {driveStatus.account}</p>
              <div className="source-search-controls"><input className="connected-field" value={driveQuery} onChange={e=>setDriveQuery(e.target.value)} placeholder="Search Drive file names or text" aria-label="Search Drive"/><button className="btn" disabled={driveBusy} onClick={()=>onSearchDrive()}>Search Drive</button><button className="btn" disabled={driveBusy} onClick={()=>onDisconnectDrive()}>Disconnect</button></div>
              {driveResults.map(x=><div className="connected-evidence" key={x.id}><strong>{x.title}</strong><p>{x.excerpt}</p><a href={x.url} target="_blank" rel="noopener noreferrer">Open in Drive <ArrowUpRight size={14}/></a></div>)}
            </>:<button className="btn primary" disabled={driveBusy||!driveStatus?.configured} onClick={()=>onConnectDrive()}>Connect Google Drive</button>}
            {!driveStatus?.configured&&<p className="caption">Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_DRIVE_REDIRECT_URI on the server to enable Drive.</p>}
          </div>}
          {sourceManage!==null&&sourceManage!=='drive'&&<div className="connected-card">
            <h2>{({github:'GitHub',notion:'Notion',slack:'Slack',calendar:'Google Calendar',linear:'Linear',jira:'Jira',onedrive:'OneDrive',outlook:'Outlook'} as Record<string,string>)[sourceProvider]} connection</h2>
            <p className="caption">{sourceProvider==='notion'?'Provide a Notion integration token, then share the pages Atlas should read with that integration. Atlas cannot access unshared workspace pages.':sourceProvider==='slack'?'Slack message search needs a user-scoped token with search:read. Bot tokens can authenticate, but Slack does not allow them to search messages.':'Provide a read-only provider-issued token. Atlas validates it and stores it encrypted on the server. This setup uses a provider-issued token, not one-click OAuth. Calendar and Microsoft access tokens expire; reconnect when needed. Jira requires server-side ATLAS_JIRA_BASE_URL.'}</p>
            {(['calendar','linear','jira','onedrive','outlook'].includes(sourceProvider))&&<p className="caption" role="note">Early access connector: you must provide an authorized provider access token. Automatic OAuth, refresh, and production verification are not available yet. Access stays read-only, and expired tokens must be replaced.</p>}
            <form onSubmit={e=>{e.preventDefault();onConnectSource()}}>
              <input className="connected-field" type="password" autoComplete="off" aria-label="Provider access token" value={sourceCredential} onChange={e=>setSourceCredential(e.target.value)} placeholder="Paste read-only access token"/>
              <button type="submit" className="btn primary" disabled={sourceBusy||!sourceCredential.trim()}>{sourceBusy?'Connecting…':'Connect account'}</button>
            </form>
            {sourceStatuses.some(x=>x.provider===sourceProvider&&x.connected)&&<>
              <div className="source-search-controls"><input className="connected-field" value={sourceSearch} onChange={e=>setSourceSearch(e.target.value)} placeholder={sourceProvider==='github'?'Search issues and PRs':sourceProvider==='notion'?'Search page titles':'Search messages'} aria-label="Search connected provider"/>
              <button className="btn" disabled={sourceBusy||!sourceSearch.trim()} onClick={()=>onSearchSource()}>Search</button>
              <button className="btn" disabled={sourceBusy} onClick={()=>onDisconnectSource(sourceProvider)}>Disconnect</button></div>
              {sourceResults.map(x=><div className="connected-evidence" key={x.id}><strong>{x.title}</strong><p>{x.excerpt}</p>{x.url&&<a href={x.url} target="_blank" rel="noopener noreferrer">Open source <ArrowUpRight size={14}/></a>}</div>)}
            </>}
          </div>}
          </Dialog>}</>;
}
