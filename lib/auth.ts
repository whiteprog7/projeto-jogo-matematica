import {headers} from 'next/headers';
import {env} from 'cloudflare:workers';
import {db,adminAllowed} from './server';
import type {ChatGPTUser} from '@/app/chatgpt-auth';
const encoder=new TextEncoder();
export const COOKIE='__Host-tufi-session';
export const config=()=>env as unknown as Record<string,string>;
export const hex=(data:ArrayBuffer|Uint8Array)=>Array.from(new Uint8Array(data instanceof Uint8Array?data.buffer:data),v=>v.toString(16).padStart(2,'0')).join('');
export const randomToken=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
export async function digest(value:string){return hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)))}
async function derive(password:string,salt:string){
 const pepper=config().AUTH_PEPPER;if(!pepper)throw new Error('Authentication configuration missing');
 const hmac=await crypto.subtle.importKey('raw',encoder.encode(pepper),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const material=await crypto.subtle.sign('HMAC',hmac,encoder.encode(password));
 const key=await crypto.subtle.importKey('raw',material,'PBKDF2',false,['deriveBits']);
 return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations:100000},key,256));
}
export async function hashPassword(password:string){const salt=randomToken();return `v1$${salt}$${await derive(password,salt)}`}
export async function verifyPassword(password:string,stored:string){
 const [version,salt,expected]=stored.split('$');if(version!=='v1'||!salt||!expected||expected.length!==64)return false;
 const actual=await derive(password,salt);let diff=0;for(let i=0;i<64;i++)diff|=actual.charCodeAt(i)^expected.charCodeAt(i);return diff===0;
}
export function sessionToken(h:Headers){const value=h.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);return value&&/^[a-f0-9]{64}$/.test(value)?value:null}
export async function getCurrentUser():Promise<ChatGPTUser|null>{
 const token=sessionToken(await headers());if(!token)return null;
 const p=await db().prepare('SELECT p.* FROM sessions s JOIN profiles p ON p.id=s.user_id WHERE s.token_hash=? AND s.expires>?').bind(await digest(token),Date.now()).first<any>();
 return p?{userId:p.id,displayName:p.name,fullName:p.name,email:p.email}:null;
}
export async function accountInfo(user:ChatGPTUser){
 const p=await db().prepare('SELECT p.id,p.name,p.role,p.requested_role,p.status,a.login_id,a.email account_email,a.email_verified FROM profiles p LEFT JOIN accounts a ON a.user_id=p.id WHERE p.id=?').bind(user.userId).first<any>();
 if(!p)return null;const admin=adminAllowed(user);return {email:p.account_email||null,emailVerified:p.email_verified===1,id:p.login_id||(admin?'ADM-0001':p.id),name:p.name,role:admin?'admin':p.status==='approved'?p.role:p.requested_role,status:admin?'approved':p.status};
}
export async function issueSession(userId:string,expectedHash?:string){
 const token=randomToken(),now=Date.now();const result=await db().batch([
 db().prepare('DELETE FROM sessions WHERE expires<=?').bind(now),
 db().prepare('INSERT INTO sessions(token_hash,user_id,expires) SELECT ?,?,? WHERE ? IS NULL OR COALESCE((SELECT password_hash FROM accounts WHERE user_id=?),?)=?').bind(await digest(token),userId,now+8*3600000,expectedHash||null,userId,userId===config().ADMIN_PROFILE_ID?config().ADMIN_PASSWORD_HASH:null,expectedHash||null)]);
 if(!result[1].meta.changes)throw new Error('Credentials changed');
 return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`;
}
export const clearCookie=()=>`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
export async function limited(bucket:string,max:number,windowMs:number){
 const now=Date.now(),key=await digest(bucket),expires=(Math.floor(now/windowMs)+1)*windowMs;
 const row=await db().prepare('INSERT INTO auth_limits(bucket,hits,expires) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET hits=CASE WHEN expires<=? THEN 1 ELSE hits+1 END,expires=excluded.expires RETURNING hits').bind(key,expires,now).first<any>();
 return row.hits>max;
}
