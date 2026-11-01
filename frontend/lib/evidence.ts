import type {Answer,Source} from './types';

/** Preserve original source positions; visible evidence cannot renumber citations. */
export function visibleEvidence(result:Answer|undefined){
 if(!result||!['ai','local_excerpts','connected','source_results'].includes(result.mode))return [];
 const cited=new Set(Array.from(result.answer.matchAll(/\[(\d+)\]/g),match=>Number(match[1])));
 return result.sources.flatMap((source,index)=>cited.has(index+1)?[{source,number:index+1}]:[]);
}

/** Connected records have provider metadata, rather than numbered document sections. */
export function sourceLocation(source:Source){
 if(source.provider)return ({github:'GitHub',drive:'Google Drive',gmail:'Gmail',notion:'Notion',slack:'Slack',calendar:'Google Calendar',linear:'Linear',jira:'Jira',onedrive:'OneDrive',outlook:'Outlook',sharepoint:'SharePoint'} as Record<string,string>)[source.provider]||source.provider;
 return source.page>0?`${source.location_type==='page'?'Page':'Section'} ${source.page}`:'Source excerpt';
}
