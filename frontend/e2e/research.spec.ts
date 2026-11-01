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

test('cited source opens inspectable passage with accessible close control',async({page})=>{
 await page.getByRole('textbox',{name:'Your question'}).fill('Summarize the sources');
 await page.getByRole('button',{name:'Send question'}).click();
 await expect(page.locator('.answer-row')).toBeVisible();
 const citation=page.locator('.source-chip').first();
 if(await citation.count()){
   await citation.click();
   const drawer=page.getByRole('dialog',{name:'Source passage'});
   await expect(drawer).toBeVisible();
   await expect(drawer.getByRole('button',{name:'Close preview'})).toBeVisible();
   await drawer.getByRole('button',{name:'Close preview'}).click();
   await expect(drawer).toHaveCount(0);
 }
});
