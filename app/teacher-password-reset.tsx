'use client';
import {useState} from 'react';
import {KeyRound} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import TemporaryCredentials from './temporary-credentials';
export default function TeacherPasswordReset({id,name,available}:{id:string;name:string;available:boolean}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[credentials,setCredentials]=useState<{temporary:string;loginId:string}|null>(null);
 async function reset(){if(busy)return;setBusy(true);setError('');try{
  const r=await fetch('/api/teacher',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'resetPassword',id}),signal:AbortSignal.timeout(15000)});const d:any=await r.json();if(!r.ok)throw Error(d.error||'Não foi possível gerar a senha.');setCredentials(d);
 }catch(e:any){setError(e.name==='TimeoutError'?'A conexão demorou demais. Atualize a lista antes de tentar novamente.':e.message)}finally{setBusy(false)}}
 function close(){setOpen(false);setCredentials(null);setError('')}
 return <><button className="secondary" disabled={!available} onClick={()=>setOpen(true)}><KeyRound size={16}/>Redefinir senha</button><Dialog open={open} onOpenChange={value=>{if(!value&&!busy)close()}}><DialogContent><DialogHeader><DialogTitle>Redefinir senha de {name}</DialogTitle><DialogDescription>Uma nova senha temporária será criada. O aluno deverá escolher sua própria senha ao entrar. O progresso será preservado.</DialogDescription></DialogHeader>{credentials?<TemporaryCredentials loginId={credentials.loginId} password={credentials.temporary} onDone={close}/>:<div className="form">{error&&<p className="message error" role="alert">{error}</p>}<button className="primary" disabled={busy} onClick={reset}>{busy?'Gerando…':'Criar senha temporária'}</button><button className="secondary" disabled={busy} onClick={close}>Cancelar</button></div>}</DialogContent></Dialog></>
}
