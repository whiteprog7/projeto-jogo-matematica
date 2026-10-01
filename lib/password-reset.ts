import {db,adminAllowed} from './server';
import {hashPassword,digest} from './auth';

// Authorization is checked again inside the transaction, after password hashing.
export async function resetAccountPassword(actor:string,target:string,teacherOnly:boolean){
 if(actor===target)return null;
 const owner=adminAllowed({userId:actor} as any);
 if(!teacherOnly&&!owner)return null;
 const scope=teacherOnly?"EXISTS(SELECT 1 FROM profiles student JOIN classes c ON c.id=student.class_id JOIN profiles teacher ON teacher.id=c.teacher WHERE student.id=accounts.user_id AND student.role='student' AND c.teacher=? AND teacher.role='teacher' AND teacher.status='approved')":"1=1";
 const args=teacherOnly?[target,actor]:[target];
 const account=await db().prepare('SELECT * FROM accounts WHERE user_id=? AND '+scope).bind(...args).first<any>();
 if(!account)return null;
 const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
 const temporary=Array.from(crypto.getRandomValues(new Uint8Array(18)),value=>alphabet[value%alphabet.length]).join('');
 const passwordHash=await hashPassword(temporary),event=crypto.randomUUID();
 const buckets=await Promise.all([account.login_id,...(account.email_verified===1&&account.email?[account.email]:[])].map(login=>digest('login:'+login.trim().toUpperCase())));
 const gate='EXISTS(SELECT 1 FROM audit WHERE id=?)';
 const result=await db().batch([
  db().prepare('INSERT INTO audit(id,actor,target,action,details,created) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM accounts WHERE user_id=? AND password_hash=? AND '+scope+')').bind(event,actor,target,'resetPassword',JSON.stringify({loginId:account.login_id,by:teacherOnly?'teacher':'admin'}),Date.now(),target,account.password_hash,...(teacherOnly?[actor]:[])),
  db().prepare('UPDATE accounts SET password_hash=?,must_change_password=1 WHERE user_id=? AND '+gate).bind(passwordHash,target,event),
  db().prepare('DELETE FROM sessions WHERE user_id=? AND '+gate).bind(target,event),
  db().prepare('DELETE FROM email_tokens WHERE user_id=? AND '+gate).bind(target,event),
  ...buckets.map(bucket=>db().prepare('DELETE FROM auth_limits WHERE bucket=? AND '+gate).bind(bucket,event))
 ]);
 return result[1].meta.changes?{ok:true,temporary,loginId:account.login_id}:null;
}
