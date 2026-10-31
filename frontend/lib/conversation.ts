/** Pure rules for choosing whether a question starts or continues a conversation. */
export type ConversationMode = 'new' | 'followup';
export type ChatEntry = {role:'user'|'assistant'; content:string};
export function conversationPlan(mode:ConversationMode, activeId:string|null, messages:ChatEntry[], question:string){
  const clean=question.trim();
  if(!clean) throw new Error('Question cannot be empty');
  const fresh=mode==='new';
  const previous=fresh?[]:messages;
  return {
    id:fresh?null:activeId,
    title:fresh?clean.slice(0,100):undefined,
    history:previous.slice(-12).map(m=>({role:m.role,content:m.content.slice(0,6000)})),
    pending:[...previous,{role:'user' as const,content:clean}],
  };
}
