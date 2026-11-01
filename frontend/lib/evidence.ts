import type {Answer} from './types';

/** Preserve original source positions; visible evidence cannot renumber citations. */
export function visibleEvidence(result:Answer|undefined){
 if(!result||!['ai','local_excerpts','connected','source_results'].includes(result.mode))return [];
 const cited=new Set(Array.from(result.answer.matchAll(/\[(\d+)\]/g),match=>Number(match[1])));
 return result.sources.flatMap((source,index)=>cited.has(index+1)?[{source,number:index+1}]:[]);
}
