import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';

// Run with a local dev server and PLAYWRIGHT_MODULE pointing to Playwright when not installed locally.
// Only the browser transport is intercepted; answers and progress use the actual game route and an isolated DB.
export async function testJourney({get,post,sql,identity,approve}){
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
 const origin=process.env.TUFI_TEST_URL||'http://localhost:5173';
 assert.ok(['localhost','127.0.0.1'].includes(new URL(origin).hostname),'Test only against a local server');
 identity('browser-test');await post({action:'profile',name:'Teste da jornada'});await approve('browser-test');
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/auth',route=>route.fulfill({json:{account:{id:'browser-test',name:'Teste da jornada',role:'student',status:'approved'},emailAvailable:false}}));
 await page.route('**/api/game**',async route=>{
  const request=route.request(),data=request.method()==='POST'?await post(request.postDataJSON()):await get(new URL(request.url()).search);
  const {status,...body}=data;await route.fulfill({status,json:body,headers:{'Cache-Control':'no-store'}});
 });
 const until=async(fn)=>{for(let i=0;i<150;i++){if(await fn())return;await new Promise(r=>setTimeout(r,100))}assert.fail('Timed out waiting for game UI')};
 const enter=async()=>{await page.goto(origin);await page.getByRole('button',{name:'Abrir aventura',exact:true}).click();await page.locator('.map-node').first().waitFor()};
 try{
  await enter();assert.equal(await page.locator('.map-node').count(),6);assert.equal(await page.locator('.secret-signal').count(),0);
  for(let region=0;region<7;region++){
   if(region===6){await page.getByRole('button',{name:'Entrar no novo mundo',exact:true}).click()}
   else{await page.locator('.map-node').nth(region).click();await page.locator('.mission-card').getByRole('button',{name:'Iniciar missão',exact:true}).click()}
   await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'Começar missão',exact:true}).click();
   for(let step=0;step<5;step++){
    await until(async()=>{const a=(await get('?view=active')).run;return a?.region===region&&a.step===step});
    const active=(await get('?view=active')).run,questions=JSON.parse(sql.prepare('SELECT questions FROM runs WHERE id=?').get(active.id).questions);
    await page.locator('.answers button').nth(questions[step].correct).click();
    const next=page.getByRole('button',{name:step===4?'Ver resultado':'Próximo desafio',exact:true});await next.waitFor();await next.click();
   }
   await page.locator('.result-panel').waitFor();assert.match(await page.locator('.result-stats').innerText(),/5\/5/);
   if(region===2)await post({action:'start',region:2});
   if(region===4){assert.match(await page.locator('.secret-signal').innerText(),/5\/6/)}
   if(region===5){
    assert.match(await page.locator('.secret-signal').innerText(),/Novo mundo desbloqueado/);
    await page.getByRole('button',{name:'Entrar no novo mundo',exact:true}).click();
    await page.getByRole('button',{name:'Agora não',exact:true}).click();
    await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();
    assert.match(await page.getByRole('dialog').innerText(),/Fortaleza dos Enigmas/i);
    await page.getByRole('button',{name:'Agora não',exact:true}).click();
   }
   await page.getByRole('button',{name:'Explorar o mapa',exact:true}).click();await page.locator('.map-node').first().waitFor();
   await until(async()=>await page.locator('.map-node').count()===(region>=5?7:6));
   if(region===5){
    await until(async()=>(await page.locator('.journey-panel').innerText()).includes('O Sétimo Sinal foi revelado'));
    assert.equal(await page.locator('.region-card').count(),7);assert.match(await page.locator('.mission-card h2').innerText(),/Divisibilidade/);
    // The saved abandoned replay must not hide the discovery after a fresh login either.
    await enter();assert.match(await page.locator('.journey-panel').innerText(),/O Sétimo Sinal foi revelado/);
    mkdirSync('outputs',{recursive:true});await page.screenshot({path:'outputs/seventh-world-desktop.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:'outputs/seventh-world-mobile.png',fullPage:true});
    await page.setViewportSize({width:1280,height:900});
   }
  }
  assert.equal((await get('')).journey.percent,100);
  // Abandoned missions remain resumable but the completion banner must reflect all seven worlds.
  assert.match(await page.locator('.secret-signal').innerText(),/jornada está completa/);
  assert.match(await page.locator('.journey-panel').innerText(),/Você completou os sete mundos/);
  await page.locator('.journey-panel').getByRole('button',{name:'Revisitar o sétimo mundo',exact:true}).click();
  assert.match(await page.locator('.mission-card h2').innerText(),/Divisibilidade/);
  await page.screenshot({path:'outputs/seven-worlds-complete.png',fullPage:true});
  identity('threshold-test');await post({action:'profile',name:'Teste dos requisitos'});await approve('threshold-test');
  for(let region=0;region<6;region++){
   const mission=await post({action:'start',region}),questions=JSON.parse(sql.prepare('SELECT questions FROM runs WHERE id=?').get(mission.id).questions);
   for(let step=0;step<5;step++)await post({action:'answer',id:mission.id,step,choice:step<4?questions[step].correct:(questions[step].correct+1)%4});
  }
  await enter();assert.equal(await page.locator('.map-node').count(),6);
  assert.doesNotMatch(await page.locator('.journey-panel').innerText(),/completou os sete mundos|Revisitar o sétimo mundo/);
  assert.match(await page.locator('.secret-signal').innerText(),/2400\/2600/);
  assert.deepEqual(errors,[]);console.log('PASS: real browser journey, all 35 answers, hints, seven map nodes/cards, direct portal entry, stale replay, reload, mobile and final completion.');
 }finally{await browser.close()}
}
