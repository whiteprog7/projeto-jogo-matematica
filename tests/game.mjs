import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,readFileSync,writeFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import path from 'node:path';import ts from 'typescript';
const temp=mkdtempSync(path.join(tmpdir(),'tufi-test-'));
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
writeFileSync(path.join(temp,'adventure.mjs'),compile(readFileSync('lib/adventure.ts','utf8')));
writeFileSync(path.join(temp,'content.mjs'),compile(readFileSync('lib/content.ts','utf8')));
writeFileSync(path.join(temp,'server.mjs'),compile(readFileSync('lib/server.ts','utf8').replace("import {env} from 'cloudflare:workers';","const env={get DB(){return globalThis.testDB},ADMIN_PROFILE_ID:'owner'};")));
let src=readFileSync('app/api/game/route.ts','utf8').replace("import {getCurrentUser as getChatGPTUser} from '@/lib/auth';","const getChatGPTUser=async()=>globalThis.testUser;").replace("from '@/lib/server'","from './server.mjs'").replace("from '@/lib/content'","from './content.mjs'").replace("from '@/lib/adventure'","from './adventure.mjs'");
writeFileSync(path.join(temp,'route.mjs'),compile(src));
writeFileSync(path.join(temp,'auth.mjs'),"export const getCurrentUser=async()=>globalThis.testUser;export const hashPassword=async password=>'test-'+password;export const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),v=>v.toString(16).padStart(2,'0')).join('');");
writeFileSync(path.join(temp,'password-reset.mjs'),compile(readFileSync('lib/password-reset.ts','utf8').replace("from './server'","from './server.mjs'").replace("from './auth'","from './auth.mjs'")));
writeFileSync(path.join(temp,'admin.mjs'),compile(readFileSync('app/api/admin/route.ts','utf8').replace("from '@/lib/auth'","from './auth.mjs'").replace("from '@/lib/password-reset'","from './password-reset.mjs'").replace("from '@/lib/server'","from './server.mjs'")));
const sql=new DatabaseSync(':memory:');for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')))sql.exec(readFileSync('drizzle/'+file,'utf8'));
globalThis.testDB={async batch(statements){sql.exec('BEGIN');try{const out=[];for(const stmt of statements)out.push(await stmt.execute());sql.exec('COMMIT');return out}catch(e){sql.exec('ROLLBACK');throw e}},prepare(query){let args=[];const stmt=sql.prepare(query);return {async execute(){if(/^SELECT/i.test(query))return {results:stmt.all(...args),meta:{changes:0}};const r=stmt.run(...args);return {results:[],meta:{changes:Number(r.changes)}}},bind(...a){args=a;return this},async first(){return stmt.get(...args)||null},async all(){return {results:stmt.all(...args)}},async run(){const r=stmt.run(...args);return {meta:{changes:Number(r.changes)}}}}}};
const {GET,POST}=await import('file://'+path.join(temp,'route.mjs'));const {makeQuestion,publicQuestion}=await import('file://'+path.join(temp,'content.mjs'));
const identity=id=>globalThis.testUser=id?{userId:id,email:id+'@example.test'}:null;
const admin=await import('file://'+path.join(temp,'admin.mjs'));
const adminPost=async data=>{const r=await admin.POST(new Request('https://tufi.test/api/admin',{method:'POST',headers:{origin:'https://tufi.test'},body:JSON.stringify(data)}));return {status:r.status,...await r.json()}};
const approve=async(id,role='student',status='approved')=>{const previous=globalThis.testUser;identity('owner');const p=sql.prepare('SELECT * FROM profiles WHERE id=?').get(id);const result=await adminPost({action:'user',id,role,status,revision:p.revision,classId:p.class_id});globalThis.testUser=previous;return result};
const post=async(data)=>{const r=await POST(new Request('https://tufi.test/api/game',{method:'POST',headers:{origin:'https://tufi.test'},body:JSON.stringify(data)}));return {status:r.status,...await r.json()}};
const get=async(q)=>{const r=await GET(new Request('https://tufi.test/api/game'+q));return {status:r.status,...await r.json()}};
identity(null);assert.equal((await get('')).status,401);
identity('owner');await post({action:'profile',name:'Owner'});
identity('alice');assert.equal((await post({action:'profile',name:'Alice'})).status,200);assert.equal((await post({action:'class',name:'6º A'})).status,403);assert.equal((await get('?view=teacher')).status,403);assert.equal((await post({action:'gear',gear:3})).status,400);assert.equal((await admin.GET()).status,403);
identity('teacher');await post({action:'profile',name:'Professor',requestedRole:'teacher'});assert.equal((await get('?view=teacher')).status,200);const c=await post({action:'class',name:'6º A'});assert.ok(c.code);
identity('alice');assert.equal((await post({action:'join',code:c.code})).status,200);
assert.equal((await post({action:'start',region:2})).status,403);let run=await post({action:'start',region:0});assert.equal(run.status,200);assert.deepEqual(Object.keys(run.question).sort(),['eliminated','hint','options','text']);assert.equal((await get('?view=active')).run.id,run.id);
assert.equal((await post({action:'bonus',id:run.id,step:0,kind:'eliminate'})).status,403);sql.prepare('UPDATE profiles SET gear=2 WHERE id=?').run('alice');const bonus=await post({action:'bonus',id:run.id,step:0,kind:'eliminate'});assert.equal(bonus.status,200);const storedQuestion=JSON.parse(sql.prepare('SELECT questions FROM runs WHERE id=?').get(run.id).questions)[0];assert.equal(bonus.indices.length,1);assert.notEqual(bonus.indices[0],storedQuestion.correct);assert.deepEqual((await post({action:'bonus',id:run.id,step:0,kind:'eliminate'})).indices,bonus.indices);assert.deepEqual((await get('?view=active')).run.question.eliminated,bonus.indices);sql.prepare('UPDATE profiles SET gear=0 WHERE id=?').run('alice');
identity('bob');await post({action:'profile',name:'Bob'});await approve('bob');assert.equal((await post({action:'answer',id:run.id,step:0,choice:0})).status,404);assert.equal((await get('?view=history&student=alice')).status,403);
identity('alice');const qs=JSON.parse(sql.prepare('SELECT questions FROM runs WHERE id=?').get(run.id).questions);
for(let step=0;step<5;step++){const b={action:'answer',id:run.id,step,choice:qs[step].correct};const result=await post(b);assert.equal(result.status,200);assert.equal(result.count,step+1);assert.deepEqual(await post(b),result)}
assert.equal(JSON.parse(sql.prepare('SELECT answers FROM runs WHERE id=?').get(run.id).answers)[0].bonus,'eliminate');
assert.equal((await get('')).stats[0].best,500);assert.equal((await get('')).journey.unlocked[1],true);assert.equal((await get('')).journey.unlocked[2],false);assert.equal((await get('')).achievements.find(a=>a.id==='portal').earned,true);assert.equal((await get('?view=ranking&region=0&mode=time')).rows.length,1);
let bad=await post({action:'start',region:1});const qbad=JSON.parse(sql.prepare('SELECT questions FROM runs WHERE id=?').get(bad.id).questions);for(let step=0;step<5;step++)await post({action:'answer',id:bad.id,step,choice:(qbad[step].correct+1)%4});assert.equal((await get('?view=ranking&region=1&mode=time')).rows.length,0);
assert.equal((await post({action:'start',region:9})).status,400);assert.equal((await post({action:'answer',id:bad.id,step:-1,choice:99})).status,400);
identity('teacher');assert.equal((await get('?view=history&student=alice')).status,200);assert.equal((await get('?view=history&student=bob')).status,403);const insight=await get('?view=teacher');assert.equal(insight.students.length,1);assert.equal(insight.students[0].xp,500);assert.equal(insight.students[0].mastered,1);assert.equal(insight.topics[1].errors,5);assert.equal(insight.evolution[0].answers,10);assert.ok(insight.questions.length>0);
// Moving class preserves personal history but excludes previous-class data from the new teacher view/ranking.
const c2=await post({action:'class',name:'6º B'});identity('alice');await post({action:'join',code:c2.code});assert.equal((await get('?view=ranking&region=0')).rows.length,0);assert.equal((await get('?view=history')).runs.length,2);identity('teacher');assert.equal((await get('?view=history&student=alice')).runs.length,0);
// Blocked teachers lose access immediately, including to previously owned classes.
identity('teacher');await approve('teacher','teacher','blocked');assert.equal((await get('?view=teacher')).status,403);await approve('teacher','teacher');
identity('alice');await approve('alice','student','blocked');assert.equal((await post({action:'start',region:0})).status,403);await post({action:'profile',name:'Alice 2',requestedRole:'teacher'});assert.equal((await get('')).profile.status,'blocked');assert.equal((await get('')).profile.role,'student');await approve('alice');
identity('owner');assert.equal((await get('?view=history&student=alice')).runs.length,2);assert.equal((await admin.GET()).status,200);const own=sql.prepare('SELECT revision FROM profiles WHERE id=?').get('owner');assert.equal((await adminPost({action:'user',id:'owner',role:'student',status:'blocked',revision:own.revision})).status,400);
const alice=sql.prepare('SELECT * FROM profiles WHERE id=?').get('alice');assert.equal((await adminPost({action:'user',id:'alice',role:'admin',status:'approved',revision:alice.revision})).status,400);assert.equal((await adminPost({action:'user',id:'alice',role:'student',status:'approved',revision:alice.revision-1})).status,409);
const klass=sql.prepare('SELECT * FROM classes WHERE code=?').get(c2.code);assert.equal((await adminPost({action:'class',id:klass.id,name:'6º B atualizado',teacher:'teacher'})).status,200);await adminPost({action:'rotateCode',id:klass.id});assert.notEqual(sql.prepare('SELECT code FROM classes WHERE id=?').get(klass.id).code,c2.code);assert.ok(sql.prepare('SELECT COUNT(*) n FROM audit').get().n>0);
identity('bob');assert.equal((await adminPost({action:'rotateCode',id:klass.id})).status,403);
const {journey,achievements,worldStories}=await import('file://'+path.join(temp,'adventure.mjs'));assert.equal(journey([]).percent,0);const all=Array.from({length:6},(_,region)=>({region,best:500,visits:1,finished:1,correct:5}));assert.equal(journey(all).percent,86);assert.equal(journey(all).expansionUnlocked,true);assert.equal(achievements(all).filter(x=>x.earned).length,6);assert.equal(journey([...all,{region:6,best:500,visits:1,finished:1,correct:5}]).percent,100);assert.equal(journey([{region:4,best:0,visits:1}]).unlocked[4],true);assert.equal(worldStories.length,7);assert.equal(new Set(worldStories.map(story=>story.title)).size,7);assert.ok(worldStories.every(story=>story.subtitle&&story.lines.length===3&&story.lines.every(line=>line.length>40)));
for(let region=0;region<7;region++)for(let stage=0;stage<5;stage++)for(let n=0;n<100;n++){const q=makeQuestion(region,stage);assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);assert.ok(q.text&&q.explanation);assert.ok(q.correct>=0&&q.correct<4);assert.equal('correct' in publicQuestion(q),false)}
// Complete actual missions through the API, including an abandoned replay like the reported case.
identity('journey-test');await post({action:'profile',name:'Explorador de teste'});await approve('journey-test');
assert.equal((await post({action:'start',region:6})).status,403);
for(let region=0;region<7;region++){
 const mission=await post({action:'start',region});assert.equal(mission.status,200);
 const questions=JSON.parse(sql.prepare('SELECT questions FROM runs WHERE id=?').get(mission.id).questions);
 for(let step=0;step<5;step++){const result=await post({action:'answer',id:mission.id,step,choice:questions[step].correct});assert.equal(result.status,200);assert.equal(result.count,step+1);assert.equal(result.done,step===4)}
 const progress=await get('');assert.equal(progress.journey.best[region],500);assert.equal(progress.journey.expansionUnlocked,region>=5);
 if(region===2)await post({action:'start',region:2});
 if(region===5){assert.equal(progress.journey.next,6);assert.equal(progress.journey.baseXp,3000);assert.equal((await get('?view=active')).run.region,2);assert.equal(progress.achievements.find(a=>a.id==='seventh-signal').earned,true)}
}
assert.equal((await get('')).journey.percent,100);assert.equal((await get('')).journey.mastered,7);
const minimum=all.map(s=>({...s,best:400,correct:4}));assert.equal(journey(minimum).expansionUnlocked,false);
assert.equal(journey(minimum.map(s=>({...s,best:s.region<2?500:400,correct:s.region===5?5:4}))).expansionUnlocked,true);
assert.equal(journey(minimum.map(s=>({...s,best:s.region<2?500:400}))).expansionUnlocked,false);
// Existing profiles keep their gear and history when outfit storage is introduced.
const legacy=new DatabaseSync(':memory:');for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')&&!f.startsWith('0004_')).sort())legacy.exec(readFileSync('drizzle/'+file,'utf8'));
legacy.exec("INSERT INTO profiles(id,name,gear,status) VALUES('existing','Existing player',8,'approved'); INSERT INTO runs(id,user_id,region,questions,started,score,correct,done,step) VALUES('saved','existing',0,'[]',1,500,5,1,5)");
legacy.exec(readFileSync('drizzle/0004_tufi_outfits.sql','utf8'));assert.equal(legacy.prepare("SELECT outfit FROM profiles WHERE id='existing'").get().outfit,0);assert.equal(legacy.prepare("SELECT gear FROM profiles WHERE id='existing'").get().gear,8);assert.equal(legacy.prepare("SELECT score FROM runs WHERE id='saved'").get().score,500);legacy.close();
identity('bob');for(const outfit of [1,2,-1,99,'1'])assert.equal((await post({action:'outfit',outfit})).status,400);for(const gear of [9,10,11,12])assert.equal((await post({action:'gear',gear})).status,400);
identity('journey-test');for(const gear of [9,10,11,12]){assert.equal((await post({action:'gear',gear})).status,200);assert.equal((await get('')).profile.gear,gear)}
assert.equal((await post({action:'outfit',outfit:2})).status,200);assert.equal((await get('')).profile.outfit,2);assert.equal((await get('')).profile.gear,12);
await post({action:'gear',gear:9});assert.equal((await get('')).profile.outfit,2);await post({action:'outfit',outfit:1});assert.equal((await get('')).profile.gear,9);
assert.equal((await post({action:'bonus',id:'unused',step:0,kind:'golden-key'})).status,403);
identity('bob');await approve('bob','student','blocked');assert.equal((await post({action:'outfit',outfit:0})).status,403);await approve('bob');
console.log('PASS: outfit migration preserves history, locked items rejected, independent saved gear/outfit, invalid outfit and blocked-account rejection.');
console.log('PASS: full API journey, 35/35 correct answers, secret-world lock/unlock, abandoned replay, persisted 100% completion and exact unlock boundaries.');
if(process.argv.includes('--browser')){await (await import('./journey-browser.mjs')).testJourney({get,post,sql,identity,approve});await (await import('./items-browser.mjs')).testItems({get,post,sql,identity})}
sql.close();rmSync(temp,{recursive:true});console.log('PASS: authentication, role/ownership checks, class isolation, mission flow, replay protection, ranking eligibility, hidden expansion rules, stored progress, and 3500 generated questions.');
