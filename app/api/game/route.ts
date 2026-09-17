import {getChatGPTUser} from '../../chatgpt-auth';
import {db,teacherAllowed} from '@/lib/server';
import {makeQuestion,publicQuestion,scoreRun,regions,gears,Question} from '@/lib/content';
export const dynamic='force-dynamic';
const reply=(d:unknown,s=200)=>Response.json(d,{status:s,headers:{'Cache-Control':'no-store'}});
async function profile(id:string){return await db().prepare('SELECT * FROM profiles WHERE id=?').bind(id).first<any>()}
async function stats(id:string){return (await db().prepare('SELECT region, MAX(score) best FROM runs WHERE user_id=? AND done=1 GROUP BY region').bind(id).all()).results}
export async function GET(request:Request){try{
 const user=await getChatGPTUser();if(!user)return reply({error:'Entre na sua conta para salvar a aventura.'},401);
 const url=new URL(request.url),view=url.searchParams.get('view')||'me';const p=await profile(user.userId);
 if(view==='me')return reply({profile:p,stats:await stats(user.userId),teacher:teacherAllowed(user.userId),identity:user.userId,class:p?.class_id?await db().prepare('SELECT name FROM classes WHERE id=?').bind(p.class_id).first():null});
 if(view==='active'){const r=await db().prepare('SELECT * FROM runs WHERE user_id=? AND done=0 AND started>? ORDER BY started DESC LIMIT 1').bind(user.userId,Date.now()-86400000).first<any>();return reply({run:r?{id:r.id,region:r.region,step:r.step,count:r.correct,question:publicQuestion(JSON.parse(r.questions)[r.step])}:null})}
 if(view==='history'){const student=url.searchParams.get('student');let id=user.userId;
 if(student&&student!==id){if(!teacherAllowed(id))return reply({error:'Acesso restrito.'},403);const own=await db().prepare('SELECT p.id FROM profiles p JOIN classes c ON c.id=p.class_id WHERE p.id=? AND c.teacher=?').bind(student,id).first();if(!own)return reply({error:'Aluno não vinculado às suas turmas.'},403);id=student;}
 return reply({runs:(await db().prepare('SELECT id,region,answers,started,correct,score,duration,done FROM runs WHERE user_id=? AND (?=0 OR class_id=(SELECT class_id FROM profiles WHERE id=?)) ORDER BY started DESC LIMIT 200').bind(id,student&&student!==user.userId?1:0,id).all()).results});}
 if(view==='ranking'){
 if(!p?.class_id)return reply({rows:[],message:'Entre em uma turma para ver o ranking.'});const region=Number(url.searchParams.get('region')||0),mode=url.searchParams.get('mode');if(!Number.isInteger(region)||region<0||region>5)return reply({error:'Região inválida.'},400);
 // Compare the same mission; one best result per student; no repeat farming.
 const order=mode==='time'?'score DESC,duration ASC':'score DESC,duration ASC';
 return reply({rows:(await db().prepare(`WITH ranked AS (SELECT r.user_id,p.name,r.score,r.correct,r.duration,ROW_NUMBER() OVER(PARTITION BY r.user_id ORDER BY r.score DESC,r.duration ASC) n FROM runs r JOIN profiles p ON p.id=r.user_id WHERE r.class_id=? AND p.class_id=? AND r.region=? AND r.done=1 ${mode==='time'?'AND r.correct>=4':''}) SELECT name,score,correct,duration FROM ranked WHERE n=1 ORDER BY ${order} LIMIT 40`).bind(p.class_id,p.class_id,region).all()).results});}
 if(view==='teacher'){if(!teacherAllowed(user.userId))return reply({error:'A escola precisa autorizar seu acesso de professor. Nenhuma turma fica disponível antes disso.'},403);return reply({classes:(await db().prepare('SELECT id,name,code FROM classes WHERE teacher=?').bind(user.userId).all()).results,students:(await db().prepare('SELECT p.id,p.name,c.name class_name,COUNT(r.id) attempts,COALESCE(SUM(r.correct),0) correct,COALESCE(SUM(r.score),0) score FROM profiles p JOIN classes c ON c.id=p.class_id LEFT JOIN runs r ON r.user_id=p.id AND r.class_id=c.id AND r.done=1 WHERE c.teacher=? GROUP BY p.id ORDER BY p.name').bind(user.userId).all()).results});}
 return reply({error:'Recurso não encontrado.'},404);
 }catch(e){console.error('game GET',e);return reply({error:'Não foi possível carregar os dados. Tente novamente.'},503)}}
export async function POST(request:Request){try{
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return reply({error:'Origem inválida.'},403);
 const user=await getChatGPTUser();if(!user)return reply({error:'Entre para salvar seu progresso.'},401);
 const raw=await request.text();if(raw.length>4096)return reply({error:'Pedido muito grande.'},413);let b:any;try{b=JSON.parse(raw)}catch{return reply({error:'Pedido inválido.'},400)}
 if(!b||typeof b!=='object')return reply({error:'Pedido inválido.'},400);
 const id=user.userId,p=await profile(id);
 if(b.action==='profile'){const name=typeof b.name==='string'?b.name.trim():'';if(name.length<2||name.length>40)return reply({error:'Use um nome de aventura de 2 a 40 caracteres.'},400);await db().prepare('INSERT INTO profiles(id,name) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name').bind(id,name).run();return reply({ok:true})}
 if(!p)return reply({error:'Escolha seu nome no perfil primeiro.'},400);
 if(b.action==='join'){if(typeof b.code!=='string'||b.code.length>30)return reply({error:'Código inválido.'},400);const c=await db().prepare('SELECT id FROM classes WHERE code=?').bind(b.code.trim().toUpperCase()).first<any>();if(!c)return reply({error:'Código não encontrado. Confira com seu professor.'},400);await db().prepare('UPDATE profiles SET class_id=? WHERE id=?').bind(c.id,id).run();return reply({ok:true})}
 if(b.action==='class'){if(!teacherAllowed(id))return reply({error:'Acesso de professor não autorizado.'},403);const name=typeof b.name==='string'?b.name.trim():'';if(name.length<2||name.length>40)return reply({error:'Nome de turma inválido.'},400);const code=crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase();await db().prepare('INSERT INTO classes(id,name,teacher,code) VALUES(?,?,?,?)').bind(crypto.randomUUID(),name,id,code).run();return reply({code})}
 if(b.action==='gear'){const s:any[]=await stats(id),xp=s.reduce((n,r)=>n+Number(r.best),0);if(!Number.isInteger(b.gear)||!gears[b.gear]||xp<gears[b.gear].xp)return reply({error:'Item ainda bloqueado.'},400);await db().prepare('UPDATE profiles SET gear=? WHERE id=?').bind(b.gear,id).run();return reply({ok:true})}
 if(b.action==='start'){if(!Number.isInteger(b.region)||!regions[b.region])return reply({error:'Região inválida.'},400);
 const recent=await db().prepare('SELECT COUNT(*) n FROM runs WHERE user_id=? AND started>?').bind(id,Date.now()-60000).first<any>();if(recent.n>=12)return reply({error:'Aguarde um minuto antes de iniciar outra missão.'},429);
 const questions=Array.from({length:5},(_,i)=>makeQuestion(b.region,i));const run=crypto.randomUUID();await db().prepare('INSERT INTO runs(id,user_id,class_id,region,questions,started) VALUES(?,?,?,?,?,?)').bind(run,id,p.class_id,b.region,JSON.stringify(questions),Date.now()).run();return reply({id:run,step:0,question:publicQuestion(questions[0])})}
 if(b.action==='answer'){if(typeof b.id!=='string'||!Number.isInteger(b.step)||!Number.isInteger(b.choice)||b.choice<0||b.choice>3)return reply({error:'Resposta inválida.'},400);const r=await db().prepare('SELECT * FROM runs WHERE id=? AND user_id=?').bind(b.id,id).first<any>();if(!r)return reply({error:'Missão não encontrada.'},404);
 const qs:Question[]=JSON.parse(r.questions),answers=JSON.parse(r.answers);
 // Repeated network submission returns the committed response; it cannot award points twice.
 if(b.step<r.step&&answers[b.step])return reply(answers[b.step].result);
 if(r.done||r.step!==b.step)return reply({error:'Etapa já encerrada. Atualize a missão.'},409);
 if(Date.now()-r.started>24*3600000)return reply({error:'Missão expirada. Inicie novamente.'},400);
 const q=qs[r.step],correct=q.correct===b.choice,count=r.correct+(correct?1:0),step=r.step+1,done=step===5,score=scoreRun(count),duration=Math.max(1,Math.round((Date.now()-r.started)/1000));
 const result={correct,correctIndex:q.correct,explanation:q.explanation,step,done,score,count,duration,next:done?null:publicQuestion(qs[step])};answers.push({text:q.text,answer:q.options[b.choice],expected:q.options[q.correct],result});
 const update=await db().prepare('UPDATE runs SET answers=?,step=?,correct=?,score=?,duration=?,done=? WHERE id=? AND user_id=? AND step=?').bind(JSON.stringify(answers),step,count,score,duration,done?1:0,r.id,id,b.step).run();if(!update.meta.changes)return reply({error:'Resposta em processamento. Tente novamente.'},409);return reply(result)}
 return reply({error:'Ação inválida.'},400);
 }catch(e){console.error('game POST',e);return reply({error:'Não foi possível salvar. Sua resposta permanece na tela; tente novamente.'},503)}}
