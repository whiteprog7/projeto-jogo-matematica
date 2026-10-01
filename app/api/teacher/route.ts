import {getCurrentUser,limited} from '@/lib/auth';
import {teacherAllowed} from '@/lib/server';
import {resetAccountPassword} from '@/lib/password-reset';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request){try{
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Origem inválida.'},403);
 const user=await getCurrentUser();if(!user)return reply({error:'Entre na sua conta.'},401);
 if(!await teacherAllowed(user.userId))return reply({error:'Acesso de professor obrigatório.'},403);
 const raw=await request.text();if(raw.length>4096)return reply({error:'Pedido muito grande.'},413);
 let b:any;try{b=JSON.parse(raw)}catch{return reply({error:'Pedido inválido.'},400)}
 if(b?.action!=='resetPassword'||typeof b.id!=='string')return reply({error:'Pedido inválido.'},400);
 if(await limited('teacher-reset:'+user.userId,30,15*60000))return reply({error:'Aguarde 15 minutos antes de gerar mais senhas.'},429);
 const result=await resetAccountPassword(user.userId,b.id,true);
 return result?reply(result):reply({error:'Aluno indisponível ou não vinculado às suas turmas. Atualize a lista.'},403);
 }catch{return reply({error:'Não foi possível gerar a senha. Tente novamente.'},503)}}
