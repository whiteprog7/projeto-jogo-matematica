import {emailAction,requestVerification} from './email-actions';
import {normalizeEmail,emailReady} from '@/lib/email';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {db,adminAllowed} from '@/lib/server';
import {getCurrentUser,accountInfo,config,hashPassword,verifyPassword,issueSession,clearCookie,sessionToken,digest,limited} from '@/lib/auth';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200,cookie?:string)=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
export async function GET(){try{const user=await getCurrentUser();return reply({account:user?await accountInfo(user):null,emailAvailable:emailReady()})}catch{return reply({error:'Não foi possível consultar sua conta. Tente novamente.'},503)}}
export async function POST(request:Request){try{
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Origem inválida.'},403);
 const raw=await request.text();if(raw.length>4096)return reply({error:'Pedido muito grande.'},413);
 let b:any;try{b=JSON.parse(raw)}catch{return reply({error:'Pedido inválido.'},400)}if(!b||typeof b!=='object')return reply({error:'Pedido inválido.'},400);
 if(b.action==='logout'){const token=sessionToken(request.headers);if(token)await db().prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(token)).run();return reply({ok:true},200,clearCookie())}
 const emailResponse=await emailAction(b,request);if(emailResponse)return emailResponse;
 if(!['login','register','link'].includes(b.action))return reply({error:'Ação inválida.'},400);
 const ip=request.headers.get('cf-connecting-ip')||'unknown';
 if(await limited('ip:'+ip,60,15*60000))return reply({error:'Muitas tentativas. Aguarde 15 minutos.'},429);
 if(typeof b.password!=='string'||b.password.length<10||b.password.length>128)return reply({error:'Use uma senha de 10 a 128 caracteres.'},400);
 if(b.action==='login'){
 const login=typeof b.login==='string'?b.login.trim().toUpperCase():'';
 if(!login||login.length>254||!['student','teacher','admin'].includes(b.role))return reply({error:'Informe seu ID, senha e tipo de conta.'},400);
 if(await limited('login:'+login,12,15*60000))return reply({error:'Muitas tentativas para esta conta. Aguarde 15 minutos.'},429);
 let adminLogin=login==='ADM123'||login==='ADM-0001';
 const a=adminLogin?await db().prepare('SELECT * FROM accounts WHERE user_id=?').bind(config().ADMIN_PROFILE_ID).first<any>():login.includes('@')?await db().prepare('SELECT * FROM accounts WHERE email=? AND email_verified=1').bind(login.toLowerCase()).first<any>():await db().prepare('SELECT * FROM accounts WHERE login_id=?').bind(login).first<any>();
 adminLogin=adminLogin||!!(a&&a.user_id===config().ADMIN_PROFILE_ID);
 const stored=a?.password_hash||(adminLogin?config().ADMIN_PASSWORD_HASH:null);
 // Run the same password derivation for unknown IDs to avoid a timing oracle.
 const valid=await verifyPassword(b.password,stored||`v1$${'0'.repeat(64)}$${'0'.repeat(64)}`);
 if(!stored||!valid)return reply({error:'ID ou senha incorretos.'},401);
 const userId=adminLogin?config().ADMIN_PROFILE_ID:a.user_id;
 if(!userId)return reply({error:'A conta administrativa ainda não está configurada.'},503);
 if(adminLogin){
 if(b.role!=='admin')return reply({error:'Esta conta deve entrar como Administrador.'},403);
 await db().prepare("INSERT INTO profiles(id,name,email,role,requested_role,status) VALUES(?,'Administrador','','student','student','approved') ON CONFLICT(id) DO NOTHING").bind(userId).run();
 }
 const u={userId,email:'',displayName:'',fullName:null};const account=await accountInfo(u);
 if(!account)return reply({error:'Conta indisponível.'},403);
 if(account.role!==b.role)return reply({error:'Selecione o tipo correto da sua conta.'},403);
 if(account.status==='blocked')return reply({error:'Conta bloqueada. Fale com o administrador.'},403);
 return reply({account},200,await issueSession(userId,stored));
 }
 if(!['student','teacher'].includes(b.role))return reply({error:'Somente alunos e professores podem solicitar cadastro.'},400);
 const name=typeof b.name==='string'?b.name.trim():'';if(name.length<2||name.length>40)return reply({error:'Use um nome de 2 a 40 caracteres.'},400);
 if(await limited('register:'+ip,10,3600000))return reply({error:'Limite de cadastros atingido. Aguarde uma hora.'},429);
 const legacy=b.action==='link'?await getChatGPTUser():null;
 if(b.action==='link'&&!legacy)return reply({error:'Entre na conta antiga para confirmar sua identidade.'},401);
 if(legacy&&adminAllowed(legacy))return reply({error:'Use a entrada Administrador e o login adm123.'},400);
 if(legacy){const existing=await db().prepare('SELECT id FROM profiles WHERE id=?').bind(legacy.userId).first();if(!existing)return reply({error:'Não há um perfil antigo para vincular. Use Cadastro.'},404);if(await db().prepare('SELECT user_id FROM accounts WHERE user_id=?').bind(legacy.userId).first())return reply({error:'Esta conta já tem ID e senha. Use Entrar.'},409)}
 const email=b.email?normalizeEmail(b.email):null;if(b.email&&!email)return reply({error:'Informe um e-mail válido.'},400);
 const userId=legacy?.userId||crypto.randomUUID(),loginId='TF-'+crypto.randomUUID().replaceAll('-','').slice(0,16).toUpperCase();
 const passwordHash=await hashPassword(b.password);
 const statements=[];
 if(!legacy)statements.push(db().prepare("INSERT INTO profiles(id,name,email,role,requested_role,status) VALUES(?,?,'','student',?,'pending')").bind(userId,name,b.role));
 statements.push(db().prepare('INSERT INTO accounts(user_id,login_id,password_hash,created) VALUES(?,?,?,?)').bind(userId,loginId,passwordHash,Date.now()));
 await db().batch(statements);
 const account=await accountInfo({userId,email:'',displayName:name,fullName:name});
 let emailNotice='';if(email){if(emailReady()){const used=await db().prepare('SELECT user_id FROM accounts WHERE email=?').bind(email).first();if(!used)try{await requestVerification(userId,email,passwordHash);emailNotice='Confira seu e-mail para confirmar o endereço.'}catch{emailNotice='Cadastro criado. Não foi possível enviar a confirmação. Entre por ID e tente vincular o e-mail novamente.'}}else emailNotice='Cadastro criado. O envio de e-mail ainda não está disponível. Guarde seu ID e vincule um e-mail depois.'}
 return reply({account,emailNotice},201,await issueSession(userId,passwordHash));
 }catch{return reply({error:'Não foi possível concluir. Tente novamente em instantes.'},503)}}
