import {db} from '@/lib/server';
import {getCurrentUser,config,hashPassword,verifyPassword,digest,randomToken,limited,clearCookie} from '@/lib/auth';
import {normalizeEmail,emailReady,sendAccountEmail} from '@/lib/email';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
const generic={message:'Se houver uma conta com esse e-mail confirmado, você receberá um link para redefinir a senha. Confira também o spam.'};
async function credentials(id:string){const a=await db().prepare('SELECT * FROM accounts WHERE user_id=?').bind(id).first<any>();if(a)return a;if(id===config().ADMIN_PROFILE_ID)return {user_id:id,login_id:'ADM-0001',password_hash:config().ADMIN_PASSWORD_HASH,email:null,email_verified:0};return null}
export async function requestVerification(userId:string,email:string,passwordHash:string){
 const token=randomToken(),tokenHash=await digest(token);
 await db().prepare("INSERT INTO email_tokens(token_hash,user_id,kind,email,expected_hash,expires) VALUES(?,?,'verify',?,?,?)").bind(tokenHash,userId,email,passwordHash,Date.now()+30*60000).run();
 try{await sendAccountEmail(email,'verify',token,tokenHash)}catch{await db().prepare('DELETE FROM email_tokens WHERE token_hash=?').bind(tokenHash).run();throw new Error('Email unavailable')}
}
export async function emailAction(b:any,request:Request):Promise<Response|null>{
 if(!['forgot','reset','verify','setEmail'].includes(b.action))return null;
 const ip=request.headers.get('cf-connecting-ip')||'unknown';
 if(await limited('email-ip:'+ip,60,15*60000))return reply({error:'Muitas tentativas. Aguarde 15 minutos.'},429);
 if(b.action==='forgot'){
 const email=normalizeEmail(b.email);if(!email)return reply({error:'Informe um e-mail válido.'},400);
 if(!emailReady())return reply({error:'A recuperação por e-mail ainda não está disponível. Tente novamente mais tarde.'},503);
 if(await limited('forgot:'+email,3,15*60000))return reply(generic);
 const a=await db().prepare('SELECT * FROM accounts WHERE email=? AND email_verified=1').bind(email).first<any>();
 if(a){const token=randomToken(),key=await digest(token);await db().prepare("INSERT INTO email_tokens(token_hash,user_id,kind,email,expected_hash,expires) VALUES(?,?,'reset',?,?,?)").bind(key,a.user_id,email,a.password_hash,Date.now()+20*60000).run();
 try{await sendAccountEmail(email,'reset',token,key)}catch{await db().prepare('DELETE FROM email_tokens WHERE token_hash=?').bind(key).run();/* Same public response for known and unknown emails; never expose tokens. */}}
 return reply(generic);
 }
 if(b.action==='setEmail'){
 const user=await getCurrentUser();if(!user)return reply({error:'Entre na sua conta para cadastrar um e-mail.'},401);
 const email=normalizeEmail(b.email);if(!email)return reply({error:'Informe um e-mail válido.'},400);
 if(!emailReady())return reply({error:'A confirmação por e-mail ainda não está disponível. Seu login por ID continua funcionando.'},503);
 if(await limited('email-user:'+user.userId,5,15*60000))return reply({error:'Aguarde 15 minutos antes de pedir outro link.'},429);
 const a=await credentials(user.userId);
 if(!a||typeof b.password!=='string'||b.password.length>128||!await verifyPassword(b.password,a.password_hash))return reply({error:'Confira sua senha atual.'},401);
 await db().prepare('INSERT INTO accounts(user_id,login_id,password_hash,created) VALUES(?,?,?,?) ON CONFLICT(user_id) DO NOTHING').bind(a.user_id,a.login_id,a.password_hash,Date.now()).run();
 const used=await db().prepare('SELECT user_id FROM accounts WHERE email=? AND user_id<>?').bind(email,user.userId).first();
 if(!used)try{await requestVerification(user.userId,email,a.password_hash)}catch{return reply({error:'Não foi possível enviar a confirmação. Tente novamente.'},503)}
 return reply({message:'Se este endereço estiver disponível, receberá um link de confirmação. Seu e-mail atual permanece válido até a troca ser confirmada.'});
 }
 if(typeof b.token!=='string'||!/^[a-f0-9]{64}$/.test(b.token))return reply({error:'Link inválido ou expirado. Solicite um novo.'},400);
 const key=await digest(b.token),kind=b.action==='reset'?'reset':'verify',now=Date.now();
 const t=await db().prepare('SELECT * FROM email_tokens WHERE token_hash=? AND kind=? AND consumed_by IS NULL AND expires>?').bind(key,kind,now).first<any>();
 if(!t)return reply({error:'Link inválido ou expirado. Solicite um novo.'},400);
 if(await limited('email-token:'+key,8,15*60000))return reply({error:'Muitas tentativas. Solicite um novo link mais tarde.'},429);
 const a=await credentials(t.user_id);
 if(!a||a.password_hash!==t.expected_hash||(kind==='reset'&&(a.email!==t.email||a.email_verified!==1)))return reply({error:'Link inválido ou expirado. Solicite um novo.'},400);
 if(typeof b.password!=='string'||b.password.length<10||b.password.length>128)return reply({error:'Use uma senha de 10 a 128 caracteres.'},400);
 if(kind==='verify'&&!await verifyPassword(b.password,a.password_hash))return reply({error:'Confira a senha da conta que solicitou a confirmação.'},401);
 if(kind==='verify'&&await db().prepare('SELECT user_id FROM accounts WHERE email=? AND user_id<>?').bind(t.email,t.user_id).first())return reply({error:'Não foi possível vincular esse e-mail. Entre na conta e solicite outro link.'},409);
 const mutation=crypto.randomUUID(),newHash=kind==='reset'?await hashPassword(b.password):null;
 const gate="EXISTS(SELECT 1 FROM email_tokens WHERE token_hash=? AND consumed_by=?)";
 const statements=[db().prepare('UPDATE email_tokens SET consumed_by=? WHERE token_hash=? AND consumed_by IS NULL AND expires>? AND EXISTS(SELECT 1 FROM accounts WHERE user_id=? AND password_hash=?)').bind(mutation,key,now,t.user_id,t.expected_hash)];
 if(kind==='reset')statements.push(db().prepare('UPDATE accounts SET password_hash=? WHERE user_id=? AND '+gate).bind(newHash,t.user_id,key,mutation));
 else statements.push(db().prepare('UPDATE accounts SET email=?,email_verified=1 WHERE user_id=? AND '+gate).bind(t.email,t.user_id,key,mutation));
 // Revoke all sessions and outstanding links atomically with the account change.
 statements.push(db().prepare('DELETE FROM sessions WHERE user_id=? AND '+gate).bind(t.user_id,key,mutation));
 statements.push(db().prepare('DELETE FROM email_tokens WHERE user_id=? AND token_hash<>? AND '+gate).bind(t.user_id,key,key,mutation));
 const result=await db().batch(statements);if(!result[0].meta.changes)return reply({error:'Este link já foi usado ou expirou.'},400);
 return Response.json({message:kind==='reset'?'Senha alterada. Entre novamente com sua nova senha.':'E-mail confirmado! Você já pode usá-lo para entrar e recuperar a senha.'},{headers:{'Cache-Control':'no-store','Set-Cookie':clearCookie()}});
}
