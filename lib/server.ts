import {env} from 'cloudflare:workers';
export function db(){if(!env.DB)throw new Error('Banco indisponível');return env.DB}
export function teacherAllowed(id:string){return ((env as unknown as Record<string,string>).TEACHER_IDS||'').split(',').map(x=>x.trim()).includes(id)}
