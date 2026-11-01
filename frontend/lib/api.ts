/** Single API client for all frontend features. */
export async function api<T>(path:string,options?:RequestInit):Promise<T>{
 const response=await fetch(`/api${path}`,{
  ...options,
  headers:options?.body instanceof FormData?options.headers:{'Content-Type':'application/json',...options?.headers}
 });
 if(!response.ok){
  const value=await response.json().catch(()=>({}));
  const detail=typeof value.detail==='string'?value.detail:Array.isArray(value.detail)?value.detail.map((item:{msg?:string})=>item.msg||'Invalid request').join('; '):'';
  throw new Error(detail||`The server returned HTTP ${response.status} for ${path}. Check the backend terminal for details.`);
 }
 return response.json();
}

export type StreamEvent={type:'status';text:string}|{type:'delta';text:string}|{type:'done';result:unknown}|{type:'error';message:string};

export async function apiStream<T>(path:string,body:unknown,onEvent:(event:StreamEvent)=>void,signal:AbortSignal):Promise<T>{
 const response=await fetch(`/api${path}`,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/x-ndjson'},body:JSON.stringify(body),signal});
 if(!response.ok){
  const value=await response.json().catch(()=>({}));
  const detail=typeof value.detail==='string'?value.detail:Array.isArray(value.detail)?value.detail.map((item:{msg?:string})=>item.msg||'Invalid request').join('; '):'';
  throw new Error(detail||`The server returned HTTP ${response.status}. Check the backend terminal for details.`);
 }
 if(!response.body)throw new Error('The server did not start an answer stream. Try again.');
 const reader=response.body.getReader();const decoder=new TextDecoder();let buffer='';let result:T|undefined;
 const consume=(line:string)=>{
  if(!line.trim())return;
  const event=JSON.parse(line) as StreamEvent;
  if(event.type==='error')throw new Error(event.message);
  if(event.type==='done')result=event.result as T;
  else onEvent(event);
 };
 while(true){
  const {done,value}=await reader.read();
  buffer+=decoder.decode(value||new Uint8Array(),{stream:!done});
  let end=buffer.indexOf('\n');
  while(end>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);consume(line);end=buffer.indexOf('\n');}
  if(done)break;
 }
 if(buffer.trim())consume(buffer);
 if(result===undefined)throw new Error('The answer stream ended before Atlas returned a result. Retry the question.');
 return result;
}
