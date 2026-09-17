import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,readFileSync,writeFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import path from 'node:path';import ts from 'typescript';
const temp=mkdtempSync(path.join(tmpdir(),'tufi-test-'));
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
writeFileSync(path.join(temp,'content.mjs'),compile(readFileSync('lib/content.ts','utf8')));
let src=readFileSync('app/api/game/route.ts','utf8').replace("import {getChatGPTUser} from '../../chatgpt-auth';","const getChatGPTUser=async()=>globalThis.testUser;").replace("import {db,teacherAllowed} from '@/lib/server';","const db=()=>globalThis.testDB; const teacherAllowed=(id)=>id==='teacher';").replace("from '@/lib/content'","from './content.mjs'");
writeFileSync(path.join(temp,'route.mjs'),compile(src));
const sql=new DatabaseSync(':memory:');for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')))sql.exec(readFileSync('drizzle/'+file,'utf8'));
globalThis.testDB={prepare(query){let args=[];const stmt=sql.prepare(query);return {bind(...a){args=a;return this},async first(){return stmt.get(...args)||null},async all(){return {results:stmt.all(...args)}},async run(){const r=stmt.run(...args);return {meta:{changes:Number(r.changes)}}}}}};
const {GET,POST}=await import('file://'+path.join(temp,'route.mjs'));const {makeQuestion,publicQuestion}=await import('file://'+path.join(temp,'content.mjs'));
const identity=id=>globalThis.testUser=id?{userId:id}:null;
const post=async(data)=>{const r=await POST(new Request('https://tufi.test/api/game',{method:'POST',headers:{origin:'https://tufi.test'},body:JSON.stringify(data)}));return {status:r.status,...await r.json()}};
const get=async(q)=>{const r=await GET(new Request('https://tufi.test/api/game'+q));return {status:r.status,...await r.json()}};
identity(null);assert.equal((await get('')).status,401);
identity('alice');assert.equal((await post({action:'profile',name:'Alice'})).status,200);assert.equal((await post({action:'class',name:'6º A'})).status,403);assert.equal((await get('?view=teacher')).status,403);assert.equal((await post({action:'gear',gear:3})).status,400);
identity('teacher');await post({action:'profile',name:'Professor'});const c=await post({action:'class',name:'6º A'});assert.ok(c.code);
identity('alice');assert.equal((await post({action:'join',code:c.code})).status,200);
let run=await post({action:'start',region:0});assert.equal(run.status,200);assert.deepEqual(Object.keys(run.question).sort(),['options','text']);assert.equal((await get('?view=active')).run.id,run.id);
identity('bob');await post({action:'profile',name:'Bob'});assert.equal((await post({action:'answer',id:run.id,step:0,choice:0})).status,404);assert.equal((await get('?view=history&student=alice')).status,403);
identity('alice');const qs=JSON.parse(sql.prepare('SELECT questions FROM runs WHERE id=?').get(run.id).questions);
for(let step=0;step<5;step++){const b={action:'answer',id:run.id,step,choice:qs[step].correct};const result=await post(b);assert.equal(result.status,200);assert.equal(result.count,step+1);assert.deepEqual(await post(b),result)}
assert.equal((await get('')).stats[0].best,500);assert.equal((await get('?view=ranking&region=0&mode=time')).rows.length,1);
let bad=await post({action:'start',region:1});const qbad=JSON.parse(sql.prepare('SELECT questions FROM runs WHERE id=?').get(bad.id).questions);for(let step=0;step<5;step++)await post({action:'answer',id:bad.id,step,choice:(qbad[step].correct+1)%4});assert.equal((await get('?view=ranking&region=1&mode=time')).rows.length,0);
assert.equal((await post({action:'start',region:9})).status,400);assert.equal((await post({action:'answer',id:bad.id,step:-1,choice:99})).status,400);
identity('teacher');assert.equal((await get('?view=history&student=alice')).status,200);assert.equal((await get('?view=history&student=bob')).status,403);assert.equal((await get('?view=teacher')).students.length,1);
// Moving class preserves personal history but excludes previous-class data from the new teacher view/ranking.
const c2=await post({action:'class',name:'6º B'});identity('alice');await post({action:'join',code:c2.code});assert.equal((await get('?view=ranking&region=0')).rows.length,0);assert.equal((await get('?view=history')).runs.length,2);identity('teacher');assert.equal((await get('?view=history&student=alice')).runs.length,0);
for(let region=0;region<6;region++)for(let stage=0;stage<5;stage++)for(let n=0;n<100;n++){const q=makeQuestion(region,stage);assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);assert.ok(q.text&&q.explanation);assert.ok(q.correct>=0&&q.correct<4);assert.equal('correct' in publicQuestion(q),false)}
sql.close();rmSync(temp,{recursive:true});console.log('PASS: authentication, role/ownership checks, class isolation, mission flow, replay protection, ranking eligibility, stored progress, and 3000 generated questions.');
