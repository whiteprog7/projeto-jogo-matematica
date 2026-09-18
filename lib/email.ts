import {config} from './auth';
export function normalizeEmail(value:unknown){
 if(typeof value!=='string')return null;const email=value.trim().toLowerCase();
 if(email.length>254||! /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(email))return null;
 const local=email.split('@')[0];return local.length<=64&&!local.startsWith('.')&&!local.endsWith('.')&&!local.includes('..')?email:null;
}
export function emailReady(){const c=config();try{const url=new URL(c.APP_ORIGIN);return !!(c.RESEND_API_KEY&&c.EMAIL_FROM&&url.protocol==='https:'&&url.pathname==='/'&&!url.search&&!url.hash&&!url.username&&!url.password)}catch{return false}}
export async function sendAccountEmail(email:string,kind:'verify'|'reset',token:string,id:string){
 if(!emailReady())throw new Error('Email unavailable');
 const c=config(),url=new URL('/conta',c.APP_ORIGIN);url.hash=new URLSearchParams({action:kind,token}).toString();
 const subject=kind==='reset'?'Tufi — redefinir sua senha':'Tufi — confirmar seu e-mail';
 const text=kind==='reset'?`Recebemos uma solicitação para alterar sua senha no Tufi.\n\nAbra o link e escolha uma nova senha:\n${url}\n\nO link vale por 20 minutos e só pode ser usado uma vez. Se não foi você, ignore esta mensagem. Sua senha continua a mesma.`:`Confirme este e-mail para usá-lo no login e na recuperação de senha do Tufi.\n\n${url}\n\nO link vale por 30 minutos. Para confirmar, informe a senha da sua conta no jogo. A confirmação do e-mail não substitui a autorização do administrador. Se não fez esta solicitação, ignore a mensagem.`;
 const response=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(10000),headers:{Authorization:'Bearer '+c.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':id},body:JSON.stringify({from:c.EMAIL_FROM,to:[email],subject,text})});
 if(!response.ok)throw new Error('Email provider unavailable');
}
