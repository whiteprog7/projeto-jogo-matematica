'use client';
import {useState} from 'react';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
export function FocusQuestion({text,active}:{text:string;active:boolean}){
 if(!active)return <>{text}</>;
 return <>{text.split(/(\d+(?:[,.]\d+)?)/g).map((part,i)=>i%2?<mark key={i}>{part}</mark>:part)}</>;
}
// Mounted with a mission/step key: drafts never cross questions or accounts.
export function GearTools({gear,focus,onFocus}:{gear:number;focus:boolean;onFocus:(value:boolean)=>void}){
 const [draft,setDraft]=useState(''),[base,setBase]=useState('2');
 if(gear<9||gear>12)return null;
 const scratch=gear===9||gear===12,lens=gear===10||gear===12,multiples=gear===11||gear===12;
 return <section className="gear-tools" aria-label="Ferramentas do equipamento">
  {lens&&<div className="lens-tool"><button className="secondary" aria-pressed={focus} onClick={()=>onFocus(!focus)}>{focus?'Desativar lente':'Ativar lente de leitura'}</button><p>A lente amplia a pergunta e destaca os números. Confira também o que o enigma pede.</p></div>}
  {scratch&&<div className="scratch-tool"><label htmlFor="question-draft">Meu rascunho</label><textarea id="question-draft" value={draft} onChange={e=>setDraft(e.target.value)} maxLength={2000} rows={3} placeholder="Escreva suas contas e ideias aqui…"/><div><small>Rascunho desta questão. Não altera a resposta nem a pontuação.</small><button className="secondary" disabled={!draft} onClick={()=>setDraft('')}>Limpar rascunho</button></div></div>}
  {multiples&&<div className="multiples-tool"><label htmlFor="multiple-base">Tabela de múltiplos</label><Select value={base} onValueChange={value=>value&&setBase(value)}><SelectTrigger id="multiple-base"><SelectValue/></SelectTrigger><SelectContent>{Array.from({length:11},(_,i)=>i+2).map(n=><SelectItem key={n} value={String(n)}>Múltiplos de {n}</SelectItem>)}</SelectContent></Select><ol aria-label={`Dez primeiros múltiplos positivos de ${base}`}>{Array.from({length:10},(_,i)=><li key={i}><span>{base} × {i+1}</span><strong>{Number(base)*(i+1)}</strong></li>)}</ol><p>Procure padrões e grupos iguais. Você escolhe a resposta do desafio.</p></div>}
 </section>;
}
