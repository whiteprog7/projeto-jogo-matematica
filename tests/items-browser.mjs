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
 const gates=[];
 const gate=()=>{let arrived,release,completed;const result={arrived:new Promise(resolve=>arrived=resolve),released:new Promise(resolve=>release=resolve),completed:new Promise(resolve=>completed=resolve),arrive:()=>arrived(),release:()=>release(),complete:()=>completed()};gates.push(result);return result};
 let profileGets=0,failProfileGets=false,failNextOutfit=false,nextProfileGate=null,nextOutfitGate=null;
 await page.route('**/api/game**',async route=>{
  const request=route.request(),query=new URL(request.url()).search;
  if(request.method()==='POST'){
   const data=request.postDataJSON();
   if(data.action==='outfit'&&failNextOutfit){failNextOutfit=false;await route.fulfill({status:503,json:{error:'Não foi possível aplicar este traje. Tente novamente.'}});return}
   const held=data.action==='outfit'?nextOutfitGate:null;
   if(held){nextOutfitGate=null;held.arrive();await held.released}
   const {status,...body}=await post(data);await route.fulfill({status,json:body});held?.complete();return;
  }
  const isProfile=!query;
  if(isProfile){profileGets++;if(failProfileGets){await route.fulfill({status:503,json:{error:'Falha simulada ao recarregar o perfil.'}});return}}
  // Capture the response before waiting: this is an actual stale profile snapshot.
  const {status,...body}=await get(query),held=isProfile?nextProfileGate:null;
  if(held){nextProfileGate=null;held.arrive();await held.released}
  await route.fulfill({status,json:body});held?.complete();
 });
 const nav=name=>page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name,exact:true}).click();
 const enter=async()=>{await page.goto(origin);await page.getByRole('button',{name:'Abrir aventura',exact:true}).click();await page.locator('.map-node').first().waitFor()};
 const equip=async name=>{await nav('Equipamentos');await page.locator('.gear-card').filter({has:page.getByRole('heading',{name,exact:true})}).getByRole('button',{name:'Equipar',exact:true}).click();await page.getByRole('status').filter({hasText:name+' equipado.'}).waitFor()};
 const start=async()=>{await nav('Aventura');await page.locator('.map-node').first().click();await page.locator('.mission-card').getByRole('button',{name:'Jogar novamente',exact:true}).click();await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'Começar missão',exact:true}).click();await page.locator('.answers').waitFor()};
 const nextQuestion=async()=>{const run=(await get('?view=active')).run,qs=JSON.parse(sql.prepare('SELECT questions FROM runs WHERE id=?').get(run.id).questions);await page.locator('.answers button').nth(qs[run.step].correct).click();await page.getByRole('button',{name:'Próximo desafio',exact:true}).click()};
 try{
  await enter();await nav('Equipamentos');assert.equal(await page.locator('.gear-card').count(),13);assert.equal(await page.locator('.outfit-card').count(),3);
  // A successful save must update the selection even if profile refresh is unavailable.
  failProfileGets=true;const readsBeforeEquip=profileGets;
  await page.locator('.outfit-card').filter({has:page.getByRole('heading',{name:'Cartógrafo das Trilhas',exact:true})}).getByRole('button',{name:'Usar este traje'}).click();
  await page.getByRole('status').filter({hasText:'Cartógrafo das Trilhas agora acompanha'}).waitFor();
  assert.equal(profileGets,readsBeforeEquip,'Equipping must not depend on a second profile request');failProfileGets=false;
  assert.equal(await page.locator('.outfit-card').nth(1).getByRole('button').getAttribute('aria-pressed'),'true');
  assert.equal((await get('')).profile.outfit,1);
  await enter();await nav('Equipamentos');assert.match(await page.locator('.outfit-current').innerText(),/Cartógrafo/);
  // A profile request started before saving must not overwrite the confirmed outfit.
  const staleProfile=gate();nextProfileGate=staleProfile;
  await nav('Aventura');await staleProfile.arrived;await nav('Equipamentos');
  await page.locator('.outfit-card').nth(2).getByRole('button').click();
  await page.getByRole('status').filter({hasText:'Guardião dos Cristais agora acompanha'}).waitFor();
  staleProfile.release();await staleProfile.completed;
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await page.locator('.outfit-card').nth(2).getByRole('button').getAttribute('aria-pressed'),'true');
  assert.match(await page.locator('.outfit-current').innerText(),/Guardião dos Cristais/);
  // A failed write keeps the old choice, explains the failure beside the buttons, and permits retry.
  failNextOutfit=true;await page.locator('.outfit-card').nth(1).getByRole('button').click();
  await page.locator('.outfit-wardrobe').getByRole('alert').filter({hasText:'Não foi possível aplicar este traje'}).waitFor();
  assert.equal((await get('')).profile.outfit,2);
  assert.equal(await page.locator('.outfit-card').nth(2).getByRole('button').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('.outfit-card').nth(1).getByRole('button').isEnabled(),true);
  await page.locator('.outfit-card').nth(1).getByRole('button').click();
  await page.getByRole('status').filter({hasText:'Cartógrafo das Trilhas agora acompanha'}).waitFor();
  assert.equal(await page.locator('.outfit-wardrobe').getByRole('alert').count(),0);
  assert.equal((await get('')).profile.outfit,1);
  // Pending is visible, but the selection changes only after the server confirms persistence.
  const delayedWrite=gate();nextOutfitGate=delayedWrite;
  await page.locator('.outfit-card').nth(2).getByRole('button').click();await delayedWrite.arrived;
  await page.locator('.outfit-card').nth(2).getByRole('button',{name:/Aplicando traje/}).waitFor();
  assert.equal(await page.locator('.outfit-card').nth(2).getByRole('button').getAttribute('aria-pressed'),'false');
  assert.equal(await page.locator('.outfit-card').nth(1).getByRole('button').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('.outfit-card').nth(2).getByRole('button').isDisabled(),true);
  assert.equal((await get('')).profile.outfit,1);
  delayedWrite.release();await delayedWrite.completed;
  await page.getByRole('status').filter({hasText:'Guardião dos Cristais agora acompanha'}).waitFor();
  assert.equal(await page.locator('.outfit-card').nth(2).getByRole('button').getAttribute('aria-pressed'),'true');
  assert.equal((await get('')).profile.outfit,2);
  await page.locator('.outfit-card').nth(1).getByRole('button').click();
  await page.getByRole('status').filter({hasText:'Cartógrafo das Trilhas agora acompanha'}).waitFor();
  console.log('PASS: outfit save without profile refresh, stale GET protection, local save error/retry, pending feedback and server-confirmed selection.');
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
 }finally{for(const held of gates)held.release();await browser.close()}
}
