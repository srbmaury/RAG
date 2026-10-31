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
