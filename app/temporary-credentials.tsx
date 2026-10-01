'use client';
import {useRef,useState} from 'react';
import {Check,Copy} from 'lucide-react';

function CredentialField({id,label,value,success}:{id:string;label:string;value:string;success:string}){
 const input=useRef<HTMLInputElement>(null);
 const [state,setState]=useState<'idle'|'copying'|'copied'|'manual'>('idle');
 async function copy(){
  setState('copying');
  try{await navigator.clipboard.writeText(value);setState('copied')}
  catch{
   // Embedded browsers may block the Clipboard API. Try the selected field,
   // then leave it selected for a manual copy if both mechanisms are denied.
   input.current?.focus();input.current?.select();
   let copied=false;try{copied=document.execCommand('copy')}catch{}
   setState(copied?'copied':'manual');
  }
 }
 return <div><label htmlFor={id}>{label}</label><div className="account-id"><input ref={input} id={id} readOnly value={value} autoComplete="off" spellCheck={false} onFocus={e=>e.currentTarget.select()}/><button type="button" disabled={state==='copying'} onClick={copy} aria-label={'Copiar '+label.replace(/^Senha/,'senha')}>{state==='copied'?<Check size={18}/>:<Copy size={18}/>}</button></div>{state==='copied'&&<p className="support left" role="status">{success}</p>}{state==='manual'&&<p className="support left orange" role="alert">A cópia automática não funcionou. O campo está selecionado: copie com Ctrl+C ou mantenha o toque no celular e escolha Copiar.</p>}</div>
}

export default function TemporaryCredentials({loginId,password,onDone}:{loginId:string;password:string;onDone:()=>void}){
 return <div className="form"><CredentialField id="temporary-login" label="ID de acesso" value={loginId} success="ID de acesso copiado."/><CredentialField id="temporary-password" label="Senha temporária" value={password} success="Senha temporária copiada."/><p className="support left">Entre com este ID e esta senha, respeitando letras maiúsculas e minúsculas. Ao gerar outra senha, a anterior deixa de funcionar.</p><p className="support left">Entregue os dados ao titular da conta por um canal seguro. A senha só aparece nesta janela.</p><button className="primary" onClick={onDone}>Concluir</button></div>
}
