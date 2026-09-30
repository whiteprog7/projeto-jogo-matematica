import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
export async function testItems({get,post,sql,identity}){
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
 const origin=process.env.TUFI_TEST_URL||'http://localhost:5173';
 assert.ok(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
 identity('journey-test');await post({action:'gear',gear:0});await post({action:'outfit',outfit:0});
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})}),page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/auth',route=>route.fulfill({json:{account:{id:'items-test',name:'Teste dos itens',role:'student',status:'approved'},emailAvailable:false}}));
 await page.route('**/api/game**',async route=>{const r=route.request(),{status,...body}=r.method()==='POST'?await post(r.postDataJSON()):await get(new URL(r.url()).search);await route.fulfill({status,json:body})});
 const nav=name=>page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name,exact:true}).click();
 const enter=async()=>{await page.goto(origin);await page.getByRole('button',{name:'Abrir aventura',exact:true}).click();await page.locator('.map-node').first().waitFor()};
 const equip=async name=>{await nav('Equipamentos');await page.locator('.gear-card').filter({has:page.getByRole('heading',{name,exact:true})}).getByRole('button',{name:'Equipar',exact:true}).click();await page.getByRole('status').filter({hasText:name+' equipado.'}).waitFor()};
 const start=async()=>{await nav('Aventura');await page.locator('.map-node').first().click();await page.locator('.mission-card').getByRole('button',{name:'Jogar novamente',exact:true}).click();await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'Começar missão',exact:true}).click();await page.locator('.answers').waitFor()};
 const nextQuestion=async()=>{const run=(await get('?view=active')).run,qs=JSON.parse(sql.prepare('SELECT questions FROM runs WHERE id=?').get(run.id).questions);await page.locator('.answers button').nth(qs[run.step].correct).click();await page.getByRole('button',{name:'Próximo desafio',exact:true}).click()};
 try{
  await enter();await nav('Equipamentos');assert.equal(await page.locator('.gear-card').count(),13);assert.equal(await page.locator('.outfit-card').count(),3);
  await page.locator('.outfit-card').filter({has:page.getByRole('heading',{name:'Cartógrafo das Trilhas',exact:true})}).getByRole('button',{name:'Usar este traje'}).click();
  await page.getByRole('status').filter({hasText:'Cartógrafo das Trilhas agora acompanha'}).waitFor();
  assert.equal((await get('')).profile.outfit,1);
  await enter();await nav('Equipamentos');assert.match(await page.locator('.outfit-current').innerText(),/Cartógrafo/);
  await equip('Caderno do Explorador');await start();assert.match(await page.locator('.battle-avatar img').getAttribute('src'),/cartografo/);
  const draft=page.getByRole('textbox',{name:'Meu rascunho'});await draft.fill('30 + 6 = 36');await nextQuestion();assert.equal(await draft.inputValue(),'');
  await equip('Lente dos Enigmas');await start();await page.getByRole('button',{name:'Ativar lente de leitura'}).click();assert.ok(await page.locator('.focus-question mark').count()>0);await nextQuestion();assert.equal(await page.locator('.focus-question').count(),0);
  await equip('Régua dos Múltiplos');await start();await page.getByRole('combobox',{name:'Tabela de múltiplos'}).click();await page.getByRole('option',{name:'Múltiplos de 7',exact:true}).click();assert.match(await page.getByRole('list',{name:'Dez primeiros múltiplos positivos de 7'}).innerText(),/70/);
  await equip('Orbe do Sétimo Sinal');await nav('Equipamentos');await page.locator('.outfit-card').filter({has:page.getByRole('heading',{name:'Guardião dos Cristais',exact:true})}).getByRole('button',{name:'Usar este traje'}).click();await page.getByRole('status').filter({hasText:'Guardião dos Cristais agora acompanha'}).waitFor();
  assert.equal((await get('')).profile.gear,12);await start();assert.equal(await page.getByRole('textbox',{name:'Meu rascunho'}).count(),1);assert.equal(await page.getByRole('combobox',{name:'Tabela de múltiplos'}).count(),1);await page.getByRole('button',{name:'Ativar lente de leitura'}).click();assert.ok(await page.locator('.focus-question mark').count()>0);assert.match(await page.locator('.battle-avatar img').getAttribute('src'),/guardiao/);
  mkdirSync('outputs',{recursive:true});await page.screenshot({path:'outputs/items-orb-desktop.png',fullPage:true});await nav('Equipamentos');
  await page.locator('.outfit-image img').first().waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('.outfit-image img')].every(img=>img.complete&&img.naturalWidth>0));
  await page.screenshot({path:'outputs/items-wardrobe-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'outputs/items-wardrobe-mobile.png',fullPage:true});
  await enter();assert.equal((await get('')).profile.outfit,2);assert.equal((await get('')).profile.gear,12);
  await page.locator('.mission-card').getByRole('button',{name:'Conhecer a história deste mundo'}).click();assert.match(await page.locator('.story-visual img').getAttribute('src'),/guardiao/);await page.getByRole('button',{name:'Agora não',exact:true}).click();
  identity('bob');await enter();await nav('Equipamentos');assert.equal(await page.locator('.outfit-card').nth(1).getByRole('button').isDisabled(),true);assert.equal(await page.locator('.gear-card').nth(9).getByRole('button').isDisabled(),true);
  assert.deepEqual(errors,[]);console.log('PASS: all four equipment powers, scratch reset, lens reset, live multiples, outfit persistence/independence, story and battle images, item locks, mobile layout.');
 }finally{await browser.close()}
}
