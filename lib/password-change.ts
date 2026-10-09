import {db} from './server';
import {getCurrentUser,accountInfo,hashPassword,verifyPassword,limited,issueSession,digest,sessionToken} from './auth';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function changePassword(b:any,request:Request){
 const user=await getCurrentUser({allowPasswordChange:true});if(!user)return reply({error:'Entre novamente para escolher sua senha.'},401);
 if(await limited('change-password:'+user.userId,8,15*60000))return reply({error:'Muitas tentativas. Aguarde 15 minutos.'},429);
 const account=await db().prepare('SELECT a.*,p.status FROM accounts a JOIN profiles p ON p.id=a.user_id WHERE a.user_id=?').bind(user.userId).first<any>();
 if(!account||account.status==='blocked')return reply({error:'Conta indisponível para alterar a senha.'},403);
 if(typeof b.password!=='string'||b.password.length<10||b.password.length>128)return reply({error:'Use uma nova senha de 10 a 128 caracteres.'},400);
 if(b.password!==b.confirmPassword)return reply({error:'As novas senhas precisam ser iguais.'},400);
 if(typeof b.currentPassword!=='string'||b.currentPassword.length>128||!await verifyPassword(b.currentPassword,account.password_hash))return reply({error:'Confira sua senha atual ou temporária.'},401);
 if(b.password===b.currentPassword)return reply({error:'Escolha uma senha diferente da atual ou temporária.'},400);
 const nextHash=await hashPassword(b.password),event=crypto.randomUUID(),gate='EXISTS(SELECT 1 FROM audit WHERE id=?)';
 const token=sessionToken(request.headers);if(!token)return reply({error:'Entre novamente para escolher sua senha.'},401);
 const changed=await db().batch([
  db().prepare("INSERT INTO audit(id,actor,target,action,details,created) SELECT ?,?,?,'changePassword','{}',? WHERE EXISTS(SELECT 1 FROM accounts a JOIN profiles p ON p.id=a.user_id JOIN sessions s ON s.user_id=a.user_id WHERE a.user_id=? AND a.password_hash=? AND p.status<>'blocked' AND s.token_hash=? AND s.expires>?)").bind(event,user.userId,user.userId,Date.now(),user.userId,account.password_hash,await digest(token),Date.now()),
  db().prepare('UPDATE accounts SET password_hash=?,must_change_password=0 WHERE user_id=? AND '+gate).bind(nextHash,user.userId,event),
  db().prepare('DELETE FROM sessions WHERE user_id=? AND '+gate).bind(user.userId,event),
  db().prepare('DELETE FROM email_tokens WHERE user_id=? AND '+gate).bind(user.userId,event)
 ]);
 if(!changed[1].meta.changes)return reply({error:'Seu acesso mudou. Entre novamente e tente outra vez.'},409);
 return Response.json({account:await accountInfo(user),message:'Senha alterada. Use sua nova senha no próximo acesso.'},{headers:{'Cache-Control':'no-store','Set-Cookie':await issueSession(user.userId,nextHash)}});
}
