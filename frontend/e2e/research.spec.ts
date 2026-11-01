import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{
  let lastId=2;
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
    if(path.includes('external')&&method==='GET')return json([]);
    if(path==='/workspaces/w1/conversations'&&method==='GET')return json([{id:'old',title:'Earlier conversation',updated:1234}]);
    if(path==='/workspaces/w1/conversations'&&method==='POST'){
      const data=route.request().postDataJSON();
      return json({id:`new-${++lastId}`,title:data.title,messages:data.messages,updated:1235});
    }
    if(path==='/workspaces/w1/conversations/old')return json({id:'old',title:'Earlier conversation',updated:1234,messages:[{role:'user',content:'Old question'}]});
    if(path.startsWith('/workspaces/w1/conversations/')&&method==='PUT'){
      const data=route.request().postDataJSON();
      return json({id:path.split('/').pop(),title:data.title,messages:data.messages,updated:1236});
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
