import {env} from 'cloudflare:workers';
import type {ChatGPTUser} from '@/app/chatgpt-auth';
export function db(){if(!env.DB)throw new Error('Banco indisponível');return env.DB}
// The initial owner is configured from the platform's verified ownership record, never from a form.
export function adminAllowed(user:ChatGPTUser|null){const owner=(env as unknown as Record<string,string>).ADMIN_EMAIL?.trim().toLowerCase();return !!(owner&&user?.userId&&user.email?.trim().toLowerCase()===owner)}
export async function teacherAllowed(id:string){const p=await db().prepare("SELECT role,status FROM profiles WHERE id=?").bind(id).first<any>();return p?.role==='teacher'&&p.status==='approved'}
