'use client';
import {Check,Lock} from 'lucide-react';
import {outfits} from '@/lib/content';
export default function OutfitWardrobe({xp,equipped,busy,pending,error,onEquip}:{xp:number;equipped:number;busy:boolean;pending:number|null;error:string;onEquip:(index:number)=>void}){
 const current=outfits[equipped]||outfits[0];
 return <section className="outfit-wardrobe" aria-labelledby="wardrobe-title">
  <div className="wardrobe-heading"><div><p className="eyebrow">O ESTILO DA SUA AVENTURA</p><h2 id="wardrobe-title">Guarda-roupa do Tufi</h2><p>Escolha um traje para as histórias e os desafios. O visual combina com qualquer equipamento.</p></div></div>
  <p className="outfit-current" role="status">Visual em uso: <strong>{current.name}</strong></p>
  {error&&<p className="message error" role="alert">{error}</p>}
  <div className="outfit-grid">{outfits.map((outfit,i)=><article className={'outfit-card '+(equipped===i?'chosen':'')} key={outfit.name}>
   <div className="outfit-image"><img src={outfit.image} alt={`Tufi com o traje ${outfit.name}`} loading="lazy"/></div>
   <div className="outfit-copy"><h3>{outfit.name}</h3><p>{outfit.description}</p><small>{outfit.xp===0?'Disponível desde o início':`${outfit.xp.toLocaleString('pt-BR')} XP para desbloquear`}</small>
    <button type="button" aria-pressed={equipped===i} aria-busy={pending===i} className={equipped===i?'secondary':'primary'} disabled={busy||xp<outfit.xp||equipped===i} onClick={()=>onEquip(i)}>{pending===i?'Aplicando traje…':xp<outfit.xp?<><Lock size={18}/>Bloqueado</>:equipped===i?<><Check size={18}/>Em uso</>:'Usar este traje'}</button>
   </div>
  </article>)}</div>
 </section>;
}
