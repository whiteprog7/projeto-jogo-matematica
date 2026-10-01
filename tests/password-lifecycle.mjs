import assert from 'node:assert/strict';
export async function testPasswordLifecycle({auth,route,admin,teacher,sql}){
 const originalHeaders=globalThis.testHeaders;
 const initial='isolated-fixture-password',chosen='my-chosen-fixture-password';
 const initialHash=await auth.hashPassword(initial);
 for(const [id,role] of [['mentor','teacher'],['other-mentor','teacher'],['pupil','student'],['outsider','student'],['without-class','student']]){
  sql.prepare("INSERT INTO profiles(id,name,email,role,requested_role,status) VALUES(?,?,'',?,?,'approved')").run(id,id,role,role);
  sql.prepare('INSERT INTO accounts(user_id,login_id,password_hash,created) VALUES(?,?,?,?)').run(id,'TF-'+id.toUpperCase(),initialHash,Date.now());
 }
 sql.prepare("INSERT INTO classes(id,name,teacher,code) VALUES('mentor-class','6 A','mentor','MENTOR-CODE'),('other-class','6 B','other-mentor','OTHER-CODE')").run();
 sql.prepare("UPDATE profiles SET class_id='mentor-class' WHERE id='pupil'").run();
 sql.prepare("UPDATE profiles SET class_id='other-class' WHERE id='outsider'").run();
 let cookie='';
 const assume=async id=>{cookie=(await auth.issueSession(id)).split(';')[0];globalThis.testHeaders=new Headers({cookie})};
 const post=async(handler,body,origin='https://tufi.test')=>{
  const headers=new Headers({cookie,origin,'cf-connecting-ip':'192.0.2.99'});globalThis.testHeaders=headers;
  const response=await handler.POST(new Request('https://tufi.test/api/test',{method:'POST',headers,body:JSON.stringify(body)}));
  if(response.headers.has('set-cookie')){cookie=response.headers.get('set-cookie').split(';')[0];globalThis.testHeaders.set('cookie',cookie)}
  return {status:response.status,body:await response.json()};
 };
 const reset=id=>post(teacher,{action:'resetPassword',id});
 const login=(password=initial)=>post(route,{action:'login',role:'student',login:'TF-PUPIL',password});
 const change=(password=chosen,currentPassword=initial,confirmPassword=password)=>post(route,{action:'changePassword',password,currentPassword,confirmPassword});
 try{
  await assume('pupil');assert.equal((await reset('outsider')).status,403);
  await assume('mentor');assert.equal((await reset('outsider')).status,403);assert.equal((await reset('without-class')).status,403);assert.equal((await reset('other-mentor')).status,403);assert.equal((await reset('owner')).status,403);assert.equal((await reset('mentor')).status,403);
  assert.equal((await post(teacher,{action:'resetPassword',id:'pupil'},'https://evil.test')).status,403);
  sql.prepare("UPDATE profiles SET status='blocked' WHERE id='mentor'").run();assert.equal((await reset('pupil')).status,403);
  sql.prepare("UPDATE profiles SET status='approved' WHERE id='mentor'").run();
  const issued=await reset('pupil');assert.equal(issued.status,200);assert.equal(issued.body.loginId,'TF-PUPIL');
  const temporary=issued.body.temporary;assert.equal((await login(initial)).status,401);
  const signed=await login(temporary);assert.equal(signed.status,200);assert.equal(signed.body.account.mustChangePassword,true);
  assert.equal(await auth.getCurrentUser(),null,'Restricted sessions cannot access game, teacher or admin handlers');
  assert.equal((await auth.getCurrentUser({allowPasswordChange:true})).userId,'pupil');
  assert.equal((await (await route.GET()).json()).account.mustChangePassword,true,'Reload preserves mandatory password choice');
  assert.equal((await admin.GET()).status,401);assert.equal((await reset('outsider')).status,401);
  assert.equal((await change(chosen,'incorrect-fixture')).status,401);
  assert.equal((await change('short',temporary)).status,400);
  assert.equal((await change(chosen,temporary,'mismatch-fixture')).status,400);
  assert.equal((await change(temporary,temporary)).status,400);
  const oldCookie=cookie;
  assert.equal((await post(route,{action:'changePassword',currentPassword:temporary,password:chosen,confirmPassword:chosen},'https://evil.test')).status,403);
  const changed=await change(chosen,temporary);assert.equal(changed.status,200);assert.equal(changed.body.account.mustChangePassword,false);assert.equal(changed.body.account.id,'TF-PUPIL');
  const newCookie=cookie;
  globalThis.testHeaders.set('cookie',oldCookie);assert.equal(await auth.getCurrentUser({allowPasswordChange:true}),null);globalThis.testHeaders.set('cookie',newCookie);
  assert.equal((await auth.getCurrentUser()).userId,'pupil');
  assert.equal((await login(temporary)).status,401);assert.equal((await login(chosen)).status,200);
  assert.equal(sql.prepare("SELECT class_id FROM profiles WHERE id='pupil'").get().class_id,'mentor-class');
  const record=sql.prepare("SELECT details FROM audit WHERE actor='mentor' AND target='pupil' AND action='resetPassword'").get();assert.equal(JSON.parse(record.details).by,'teacher');assert.ok(!record.details.includes(temporary));
  // An obsolete teacher roster cannot reset a pupil who moved to another class.
  await assume('mentor');sql.prepare("UPDATE profiles SET class_id='other-class' WHERE id='pupil'").run();assert.equal((await reset('pupil')).status,403);
  // Recheck classroom scope after hashing: a move during the request must abort all writes.
  sql.prepare("UPDATE profiles SET class_id='mentor-class' WHERE id='pupil'").run();
  const batch=globalThis.testDB.batch;globalThis.testDB.batch=async statements=>{sql.prepare("UPDATE profiles SET class_id='other-class' WHERE id='pupil'").run();return batch(statements)};
  try{assert.equal((await reset('pupil')).status,403)}finally{globalThis.testDB.batch=batch}
  assert.equal(await auth.verifyPassword(chosen,sql.prepare("SELECT password_hash FROM accounts WHERE user_id='pupil'").get().password_hash),true);
  // Admin-issued temporary credentials also require replacement, including teachers.
  await assume('owner');const adminReset=await post(admin,{action:'resetPassword',id:'mentor'});assert.equal(adminReset.status,200);
  const mentorLogin=await post(route,{action:'login',role:'teacher',login:'TF-MENTOR',password:adminReset.body.temporary});assert.equal(mentorLogin.body.account.mustChangePassword,true);assert.equal((await reset('pupil')).status,401);
  console.log('PASS: teacher class isolation, role/block/CSRF checks, moved pupil and transaction race, restricted temporary sessions, mandatory change/reload, password validation, rotation, audit and stable ID/class.');
 }finally{globalThis.testHeaders=originalHeaders}
}
