import {env} from 'cloudflare:workers';
import type {ChatGPTUser} from '@/app/chatgpt-auth';
export function db(){if(!env.DB)throw new Error('Banco indisponível');return env.DB}
// Only this server-configured profile can administer the game. Form values never grant ownership.
export function adminAllowed(user:ChatGPTUser|null){const owner=(env as unknown as Record<string,string>).ADMIN_PROFILE_ID;return !!(owner&&user?.userId===owner)}
export async function teacherAllowed(id:string){const p=await db().prepare("SELECT role,status FROM profiles WHERE id=?").bind(id).first<any>();return p?.role==='teacher'&&p.status==='approved'}
