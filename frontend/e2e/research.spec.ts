import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{
  let lastId=2;
  const savedConversations=new Map<string,{id:string;title:string;messages:unknown[];updated:number}>();
  await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url());
    const path=url.pathname.replace(/^\/api/,'');
    const method=route.request().method();
    const json=(value:unknown)=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(value)});
    if(path==='/me') return json({id:'u1',email:'test@example.com',mode:'ai',max_file_bytes:10485760});
    if(path==='/workspaces') return json([{id:'w1',name:'Test workspace'}]);
    if(path==='/workspaces/w1/documents')return json([{id:'d1',name:'notes.md',size:128,status:'ready',pages:1,chunk_count:1}]);
    if(path==='/gmail/status')return json({connected:false,email:null,configured:false});
    if(path==='/drive/status')return json({connected:false,account:null,configured:false});
    if(path==='/workspaces/w1/sources')return json([{provider:'github',connected:true,account:'test-user'}]);
    if(path.includes('external')&&method==='GET')return json([]);
    if(path==='/workspaces/w1/conversations'&&method==='GET')return json([{id:'old',title:'Earlier conversation',updated:1234}]);
    if(path==='/workspaces/w1/conversations'&&method==='POST'){
      const data=route.request().postDataJSON();
      const item={id:`new-${++lastId}`,title:data.title,messages:data.messages,updated:1235};
      savedConversations.set(item.id,item);
      return json(item);
    }
    if(path==='/workspaces/w1/conversations/old')return json({id:'old',title:'Earlier conversation',updated:1234,messages:[{role:'user',content:'Old question'}]});
    if(path.startsWith('/workspaces/w1/conversations/')&&method==='GET')return json(savedConversations.get(path.split('/').pop()!)||{id:path.split('/').pop(),title:'New chat',messages:[],updated:1235});
    if(path.startsWith('/workspaces/w1/conversations/')&&method==='PUT'){
      const data=route.request().postDataJSON();
      const item={id:path.split('/').pop()!,title:data.title,messages:data.messages,updated:1236};
      savedConversations.set(item.id,item);
      return json(item);
    }
    if(path==='/workspaces/w1/connected-chat/stream'&&method==='POST'){
      const data=route.request().postDataJSON();
      const scope=[...(data.include_documents?['documents']:[]),...(data.include_gmail?['gmail']:[]),...(data.providers||[])];
      const sources=(data.providers||[]).includes('github')?[{chunk_id:'pr-1',document_id:'',name:'A very long GitHub pull request title without a file extension',page:0,location_type:'github',provider:'github',url:'https://github.com/example/repo/pull/1',text:'A connected GitHub record.'}]:[];
      const result={answer:'The answer is grounded in the selected sources. [1]',sources,mode:'connected',scope};
      const body=[
        {type:'status',text:'Searching selected sources…'},
        {type:'delta',text:result.answer},
        {type:'done',result}
      ].map(event=>JSON.stringify(event)).join('\n')+'\n';
      return route.fulfill({status:200,contentType:'application/x-ndjson',body});
    }
    if(path==='/workspaces/w1/chat')return json({answer:'The answer is grounded in the document. '.repeat(60),sources:[],mode:'ai'});
    if(path==='/workspaces/w1/source-status'||path==='/workspaces/w1/external-connections')return json([]);
    return json([]);
  });
  await page.goto('/');
  await expect(page.getByRole('navigation',{name:'Main navigation'})).toBeVisible();
});

test('Home question begins an independent conversation',async({page})=>{
  await page.getByRole('button',{name:'Home',exact:true}).click();
  await page.getByRole('textbox',{name:'Ask Atlas'}).fill('Fresh question from home');
  await page.getByRole('button',{name:'Ask Atlas',exact:true}).last().click();
  await expect(page.getByText('Fresh question from home').first()).toBeVisible();
  await expect(page.locator('.user-message')).toHaveCount(1);
});

test('composer remains in view after long response',async({page})=>{
  await page.getByRole('textbox',{name:'Your question'}).fill('Write a long answer');
  await page.getByRole('button',{name:'Send question'}).click();
  await expect(page.locator('.answer-row')).toBeVisible();
  const thread=page.locator('.chat-workspace .thread');
  const composer=page.locator('.chat-workspace .composer');
  await expect(composer).toBeInViewport();
  await thread.evaluate(node=>node.scrollTop=node.scrollHeight);
  await expect(composer).toBeInViewport();
});

test('Gmail replaces sources gallery without stacking beneath it',async({page})=>{
  await page.getByRole('button',{name:'Sources',exact:true}).click();
  await page.locator('.integration-tile').filter({hasText:'Gmail'}).click();
  await expect(page.getByRole('heading',{name:'Gmail',exact:true})).toBeVisible();
  await expect(page.locator('.integrations-grid')).toHaveCount(0);
  await page.getByRole('button',{name:/All sources/}).click();
  await expect(page.locator('.integrations-grid')).toBeVisible();
});

test('All conversations opens the saved history panel',async({page})=>{
  await page.getByRole('button',{name:/All conversations/}).click();
  await expect(page.locator('.chat-history')).toBeVisible();
  await expect(page.locator('.chat-history-open')).toHaveText('Earlier conversation');
  await page.getByRole('button',{name:'Home',exact:true}).click();
  await page.getByRole('button',{name:'Open conversations',exact:true}).click();
  await expect(page.locator('.chat-history')).toBeVisible();
});

test('connection dialog traps focus and dismisses with Escape',async({page})=>{
  await page.getByRole('button',{name:'Sources',exact:true}).click();
  await page.locator('.integration-tile').filter({hasText:'GitHub'}).click();
  const dialog=page.getByRole('dialog',{name:'Manage source connection'});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Close dialog'})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('source-only questions can exclude documents and restore scope from chat history',async({page})=>{
  await page.getByRole('checkbox',{name:'Documents'}).uncheck();
  await page.getByRole('checkbox',{name:'GitHub'}).check();
  await page.getByRole('textbox',{name:'Your question'}).fill('List three open pull requests from GitHub');
  await page.getByRole('button',{name:'Send question'}).click();
  await expect(page.locator('.answer-head').last()).toContainText('GitHub');
  await expect(page.locator('.answer-head').last()).not.toContainText('Documents');
  await page.getByRole('checkbox',{name:'Documents'}).check();
  await page.getByRole('checkbox',{name:'GitHub'}).uncheck();
  await page.getByRole('button',{name:'List three open pull requests from GitHub',exact:true}).click();
  await expect(page.getByRole('checkbox',{name:'Documents'})).not.toBeChecked();
  await expect(page.getByRole('checkbox',{name:'GitHub'})).toBeChecked();
});

test('new chat resets source scope to documents only',async({page})=>{
  await page.getByRole('checkbox',{name:'Documents'}).uncheck();
  await page.getByRole('checkbox',{name:'GitHub'}).check();
  await page.getByRole('button',{name:'New chat',exact:true}).click();
  await expect(page.getByRole('checkbox',{name:'Documents'})).toBeChecked();
  await expect(page.getByRole('checkbox',{name:'GitHub'})).not.toBeChecked();
});

test('personal pull-request questions route to connected GitHub only',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.getByRole('textbox',{name:'Your question'}).fill('my pull requests');
  await page.getByRole('button',{name:'Send question'}).click();
  await expect(page.locator('.answer-head').last()).toContainText('GitHub');
  await expect(page.locator('.answer-head').last()).not.toContainText('Documents');
  await expect(page.getByRole('checkbox',{name:'Documents'})).not.toBeChecked();
  await expect(page.getByRole('checkbox',{name:'GitHub'})).toBeChecked();
  await expect(page.locator('.evidence-panel')).toHaveCount(0);
  await expect(page.locator('.answer .source-chip .file.source')).toHaveText('SRC');
  const badge=await page.locator('.answer .source-chip .file.source').boundingBox();
  expect(badge?.width).toBe(25);
  const research=await page.locator('.chat-workspace .research').evaluate(node=>getComputedStyle(node).gridTemplateColumns);
  expect(research.trim().split(/\s+/)).toHaveLength(1);
});

test('global search starts independent research after opening a saved chat',async({page})=>{
  await page.getByRole('button',{name:'Earlier conversation',exact:true}).click();
  await expect(page.locator('.user-message')).toHaveText(/Old question/);
  await page.getByRole('button',{name:/Search documents or ask/}).click();
  await expect(page.getByRole('textbox',{name:'Search your workspace',exact:true})).toBeFocused();
  await page.getByRole('textbox',{name:'Search your workspace',exact:true}).fill('Independent question');
  await page.getByRole('button',{name:'Ask Atlas: Independent question',exact:true}).click();
  await expect(page.locator('.answer-row')).toBeVisible();
  await expect(page.locator('.user-message')).toHaveCount(1);
  await expect(page.locator('.user-message')).toHaveText(/Independent question/);
});

test('library search and clear restore the document list',async({page})=>{
  await page.getByRole('button',{name:'Documents',exact:true}).click();
  await page.getByRole('searchbox',{name:'Search documents'}).fill('missing-file');
  await expect(page.getByRole('heading',{name:'No matching documents'})).toBeVisible();
  await page.getByRole('button',{name:'Clear search',exact:true}).click();
  await expect(page.getByRole('button',{name:'notes.md',exact:true})).toBeVisible();
});

test('mobile navigation closes after choosing a destination',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Open menu',exact:true}).click();
  await page.getByRole('button',{name:'Documents',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Documents',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Close navigation',exact:true})).toHaveCount(0);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
  expect(overflow).toBe(false);
});

test('Home keeps the primary research entry accessible on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Open menu',exact:true}).click();
 await page.getByRole('button',{name:'Home',exact:true}).click();
 await expect(page.getByRole('heading',{name:/What would you like/})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Ask Atlas'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)).toBe(false);
});

test('nested citations open a modal excerpt and restore focus',async({page})=>{
 await page.route('**/api/workspaces/w1/connected-chat/stream',route=>route.fulfill({status:200,contentType:'application/x-ndjson',body:JSON.stringify({type:'done',result:{answer:'Evidence **supports [1]**.',mode:'connected',sources:[{chunk_id:'pr-1',document_id:'',name:'Release decision',page:0,location_type:'github',provider:'github',url:'https://github.com/example/repo/pull/1',text:'Release after accessibility review.'}]}})+'\n'}));
 await page.getByRole('checkbox',{name:'GitHub'}).check();
 await page.getByRole('textbox',{name:'Your question'}).fill('Summarize the sources');
 await page.getByRole('button',{name:'Send question'}).click();
 const citation=page.getByRole('button',{name:'Open source 1: Release decision',exact:true});
 await expect(citation).toBeVisible();
 await citation.click();
 const drawer=page.getByRole('dialog',{name:'Source passage'});
 await expect(drawer).toContainText('Release after accessibility review.');
 await page.screenshot({path:'/tmp/atlas-audit/after-evidence.png',animations:'disabled'});
 await expect(drawer).toContainText('GitHub');
 await expect(drawer).not.toContainText('Section 0');
 await expect(drawer.getByRole('link',{name:'Open source',exact:true})).toHaveAttribute('href','https://github.com/example/repo/pull/1');
 await expect(drawer.getByRole('button',{name:'Close preview'})).toBeFocused();
 await page.keyboard.press('Shift+Tab');
 await expect(drawer.getByRole('button',{name:'Close',exact:true})).toBeFocused();
 await page.keyboard.press('Tab');
 await expect(drawer.getByRole('button',{name:'Close preview'})).toBeFocused();
 await page.keyboard.press('Escape');
 await expect(drawer).toHaveCount(0);
 await expect(citation).toBeFocused();
});

test('IME confirmation does not submit a question',async({page})=>{
 const input=page.getByRole('textbox',{name:'Your question'});
 await input.fill('質問');
 await input.dispatchEvent('keydown',{key:'Enter',isComposing:true});
 await expect(page.locator('.user-message')).toHaveCount(0);
});

test('audit screen captures',async({page})=>{
 test.setTimeout(120000);
 for(const width of [390,768,1280,1920]){
 await page.setViewportSize({width,height:900});
 for(const theme of ['light','dark']){
 await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
 for(const screen of ['Home','Documents','Sources','Ask Atlas']){
 if(await page.getByRole('button',{name:'Open menu',exact:true}).isVisible())await page.getByRole('button',{name:'Open menu',exact:true}).click();
 await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:screen,exact:true}).click();
 await page.screenshot({path:`/tmp/atlas-audit/${process.env.AUDIT_PHASE||'after'}-${screen}-${width}-${theme}.png`,fullPage:true,animations:'disabled'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),`${screen} ${width} ${theme}`).toBe(false);
 if(width>600){
 const sidebar=await page.locator('.sidebar').boundingBox();
 const main=await page.locator('.main').boundingBox();
 expect(main!.x,`Navigation must not cover ${screen} at ${width}px`).toBeGreaterThanOrEqual(sidebar!.x+sidebar!.width);
 }
 }
 }
 }
});

test('document processing failures expose context and retry',async({page})=>{
 await page.route('**/api/workspaces/w1/documents',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([
 {id:'bad',name:'failed.pdf',size:512,status:'failed',pages:0,chunk_count:0,error:'The PDF is password protected. Upload an unlocked copy.'},
 {id:'pending',name:'pending.md',size:128,status:'processing',pages:1,chunk_count:0}
 ])}));
 await page.reload();
 await page.getByRole('button',{name:'Documents',exact:true}).click();
 await expect(page.getByText('The PDF is password protected. Upload an unlocked copy.')).toBeVisible();
 await expect(page.getByRole('button',{name:'Reindex failed.pdf'})).toBeVisible();
 await expect(page.getByText('Processing',{exact:true})).toBeVisible();
 await page.getByRole('searchbox',{name:'Search documents'}).fill('absent');
 await expect(page.getByRole('heading',{name:'No matching documents'})).toBeVisible();
});

test('authentication failure stays actionable and announced',async({page})=>{
 await page.route('**/api/me',route=>route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({detail:'Please sign in.'})}));
 await page.reload();
 await expect(page.getByRole('heading',{name:'Create your workspace'})).toBeVisible();
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.route('**/api/auth/login',route=>route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({detail:'Incorrect email or password.'})}));
 await page.getByLabel('Email address').fill('test@example.com');
 await page.getByLabel('Password',{exact:true}).fill('wrong-password');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.locator('.auth-form').getByRole('alert')).toContainText('Incorrect email or password.');
 await page.screenshot({path:'/tmp/atlas-audit/after-auth.png',animations:'disabled'});
});
