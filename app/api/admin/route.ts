import {getCurrentUser as getChatGPTUser} from '@/lib/auth';
import {db,adminAllowed} from '@/lib/server';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){try{const u=await getChatGPTUser();if(!u)return reply({error:'Entre na sua conta.'},401);if(!adminAllowed(u))return reply({error:'Somente o administrador pode acessar este painel.'},403);
 const result=await db().batch([
 db().prepare('SELECT (SELECT login_id FROM accounts WHERE user_id=p.id) login_id,p.id,p.name,p.email,p.role,p.requested_role,p.status,p.revision,p.class_id,c.name class_name,(SELECT COUNT(*) FROM runs r WHERE r.user_id=p.id AND r.done=1) missions FROM profiles p LEFT JOIN classes c ON c.id=p.class_id ORDER BY p.status,p.name'),
 db().prepare('SELECT c.id,c.name,c.teacher,c.code,p.name teacher_name,(SELECT COUNT(*) FROM profiles s WHERE s.class_id=c.id) students FROM classes c LEFT JOIN profiles p ON p.id=c.teacher ORDER BY c.name'),
 db().prepare('SELECT a.*,p.name target_name FROM audit a LEFT JOIN profiles p ON p.id=a.target ORDER BY created DESC LIMIT 100')]);
 return reply({users:result[0].results,classes:result[1].results,audit:result[2].results,ownerId:u.userId});
 }catch(e){console.error('admin GET',e);return reply({error:'Não foi possível carregar a administração.'},503)}}
export async function POST(request:Request){try{const u=await getChatGPTUser();if(!u)return reply({error:'Entre na sua conta.'},401);if(!adminAllowed(u))return reply({error:'Acesso de administrador obrigatório.'},403);if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Origem inválida.'},403);
 const raw=await request.text();if(raw.length>4096)return reply({error:'Pedido muito grande.'},413);let b:any;try{b=JSON.parse(raw)}catch{return reply({error:'Pedido inválido.'},400)}if(!b||typeof b!=='object')return reply({error:'Pedido inválido.'},400);
 const time=Date.now(),auditId=crypto.randomUUID();
 if(b.action==='user'){
 if(typeof b.id!=='string'||!['student','teacher'].includes(b.role)||!['pending','approved','blocked'].includes(b.status)||!Number.isInteger(b.revision))return reply({error:'Dados inválidos.'},400);
 const p=await db().prepare('SELECT * FROM profiles WHERE id=?').bind(b.id).first<any>();if(!p)return reply({error:'Cadastro não encontrado.'},404);
 if(p.id===u.userId)return reply({error:'A conta do proprietário não pode ser alterada por este painel.'},400);
 if(p.revision!==b.revision)return reply({error:'Este cadastro foi alterado. Atualize a lista antes de continuar.'},409);
 const classId=b.classId||null;if(classId!==null&&typeof classId!=='string')return reply({error:'Turma inválida.'},400);if(classId&&!await db().prepare('SELECT id FROM classes WHERE id=?').bind(classId).first())return reply({error:'Turma não encontrada.'},400);
 const detail=JSON.stringify({before:{role:p.role,status:p.status,classId:p.class_id},after:{role:b.role,status:b.status,classId}});
 // Audit is inserted only for the expected revision. Its presence gates the atomic update.
 const batch=await db().batch([
 db().prepare('INSERT INTO audit(id,actor,target,action,details,created) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM profiles WHERE id=? AND revision=?)').bind(auditId,u.userId,p.id,'user',detail,time,p.id,b.revision),
 db().prepare('UPDATE profiles SET role=?,status=?,class_id=?,revision=revision+1 WHERE id=? AND revision=? AND EXISTS(SELECT 1 FROM audit WHERE id=?)').bind(b.role,b.status,classId,p.id,b.revision,auditId)]);
 if(!batch[1].meta.changes)return reply({error:'Cadastro alterado em outra janela. Atualize a lista.'},409);return reply({ok:true});}
 if(b.action==='class'){
 const name=typeof b.name==='string'?b.name.trim():'';if(name.length<2||name.length>40||typeof b.teacher!=='string')return reply({error:'Informe nome e professor da turma.'},400);
 const t=await db().prepare('SELECT * FROM profiles WHERE id=?').bind(b.teacher).first<any>();if(!t||(t.id!==u.userId&&(t.role!=='teacher'||t.status!=='approved')))return reply({error:'Selecione um professor aprovado.'},400);
 const id=b.id||crypto.randomUUID();if(typeof id!=='string')return reply({error:'Turma inválida.'},400);if(b.id&&!await db().prepare('SELECT id FROM classes WHERE id=?').bind(id).first())return reply({error:'Turma não encontrada.'},404);
 const code=crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase();
 await db().batch([db().prepare('INSERT INTO classes(id,name,teacher,code) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,teacher=excluded.teacher').bind(id,name,b.teacher,code),db().prepare('INSERT INTO audit(id,actor,target,action,details,created) VALUES(?,?,?,?,?,?)').bind(auditId,u.userId,id,'class',JSON.stringify({name,teacher:b.teacher}),time)]);return reply({ok:true});}
 if(b.action==='rotateCode'){if(typeof b.id!=='string'||!await db().prepare('SELECT id FROM classes WHERE id=?').bind(b.id).first())return reply({error:'Turma não encontrada.'},404);const code=crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase();await db().batch([db().prepare('UPDATE classes SET code=? WHERE id=?').bind(code,b.id),db().prepare('INSERT INTO audit(id,actor,target,action,details,created) VALUES(?,?,?,?,?,?)').bind(auditId,u.userId,b.id,'rotateCode','{}',time)]);return reply({ok:true})}
 return reply({error:'Ação desconhecida.'},400);
 }catch(e){console.error('admin POST',e);return reply({error:'Não foi possível salvar a alteração. Tente novamente.'},503)}}
