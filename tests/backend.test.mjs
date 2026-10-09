import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const anna='11111111-1111-4111-8111-111111111111';
const mark='22222222-2222-4222-8222-222222222222';
const outsider='33333333-3333-4333-8333-333333333333';

test('Supabase migration: membership isolation, concurrency, timestamps and preserved history', async () => {
 const db = new PGlite();
 try {
 await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
 insert into auth.users values('${anna}'),('${mark}'),('${outsider}');`);
 await db.exec(await readFile(new URL('../supabase/migrations/202609180001_households.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/202609180002_personal_contributions.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/202609180003_personal_cleaning.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/202609180004_retired_zone_duties.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/202610090001_shared_cleaning_rotation.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/202610090002_replan_cleaning_duties.sql',import.meta.url),'utf8'));
 const asUser = async id => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]); await db.exec('set role authenticated'); };
 const read = async () => (await db.query('select * from public.oikos_households')).rows;
 const save = async (h,state,rev=h.revision) => db.query('select public.oikos_save_house($1,$2,$3)',[h.id,rev,JSON.stringify(state)]);
 await asUser(anna);
 await db.query('select public.oikos_create_house($1,$2)',['Nasz dom','Anna']);
 let [h]=await read(); const firstInvite=h.invite_token;
 assert.equal(h.state.members[0].id,anna);
 await asUser(outsider);assert.equal((await read()).length,0);
 await assert.rejects(save(h,h.state),/Access denied/);
 await assert.rejects(db.query('update public.oikos_households set revision=2'),/permission denied/);
 await db.exec('reset role; set role anon');
 await assert.rejects(db.query('select public.oikos_create_house($1,$2)',['X','X']),/permission denied/);
 await asUser(mark);await db.query('select public.oikos_join_house($1,$2)',[firstInvite,'Mark']);
 [h]=await read(); assert.equal(h.state.members.length,2);
 for (const [field,value] of [['contributionAmount',999],['contributionStatus','paid'],['contributionPaidAt','2026-09-18T12:00:00Z']]) {
  const forged=structuredClone(h.state);
  forged.activeMemberId=anna;
  forged.members.find(m=>m.id===anna)[field]=value;
  await assert.rejects(save(h,forged),/OIKOS_OWN_CONTRIBUTION_ONLY/);
 }
 let own=structuredClone(h.state);own.members.find(m=>m.id===mark).contributionAmount=125.5;
 await save(h,own);[h]=await read();
 assert.equal(h.state.members.find(m=>m.id===mark).contributionAmount,125.5);
 await asUser(anna);
 assert.equal((await read())[0].state.members.find(m=>m.id===mark).contributionAmount,125.5);
 const forbidden=structuredClone(h.state);forbidden.members.find(m=>m.id===mark).contributionAmount=1;
 await assert.rejects(save(h,forbidden),/OIKOS_OWN_CONTRIBUTION_ONLY/);
 await asUser(mark);
 own=structuredClone(h.state);own.members.find(m=>m.id===mark).contributionAmount=0;
 await save(h,own);[h]=await read();
 assert.equal(h.state.members.find(m=>m.id===mark).contributionAmount,0);
 let state=structuredClone(h.state);
 state.cleaningZones=[{id:'k',name:'Kuchnia',order:0}];
 state.cleaningAssignments=[{id:'a',weekKey:'2026-W38',weekLabel:'Week 1',zoneId:'k',zoneName:'Kuchnia',assignedMemberId:anna,assignedMemberName:'Anna',status:'pending',completedAt:null,completedById:null,manualOverride:false}];
 state.groceryExpenses=[{id:'expense',purchaserId:anna,amount:20,note:'Chleb',createdAt:new Date().toISOString(),type:'manual',tripId:null}];
 await save(h,state);
 await assert.rejects(save(h,state),/OIKOS_CONFLICT/);
 [h]=await read();state=structuredClone(h.state);
 state.cleaningAssignments[0].status='completed';state.cleaningAssignments[0].completedAt='2000-01-01';state.cleaningAssignments[0].completedById=outsider;
 await assert.rejects(save(h,state),/OIKOS_OWN_CLEANING_ONLY/);
 for (const modify of [
  s=>{s.cleaningAssignments=[];},
  s=>{s.cleaningAssignments[0].assignedMemberId=mark;},
  s=>{s.cleaningAssignments[0].zoneName='Changed';},
  s=>{s.cleaningAssignments[0].id='replacement';},
 ]) {
  const forged=structuredClone(h.state);forged.activeMemberId=anna;modify(forged);
  await assert.rejects(save(h,forged),/OIKOS_OWN_CLEANING_ONLY/);
 }
 const duplicate=structuredClone(h.state);duplicate.cleaningAssignments.push({...duplicate.cleaningAssignments[0],id:'copy',assignedMemberId:mark});
 await assert.rejects(save(h,duplicate),/Duplicate cleaning duty/);
 const invented=structuredClone(h.state);invented.cleaningAssignments.push({...state.cleaningAssignments[0],id:'new-completion',zoneId:'new-zone',assignedMemberId:mark});
 await assert.rejects(save(h,invented),/OIKOS_OWN_CLEANING_ONLY/);
 await asUser(anna);
 const ownEdit=structuredClone(h.state);ownEdit.cleaningAssignments[0].manualOverride=true;
 await save(h,ownEdit);[h]=await read();
 state=structuredClone(h.state);state.cleaningAssignments[0].status='completed';state.cleaningAssignments[0].completedAt='2000-01-01';state.cleaningAssignments[0].completedById=outsider;
 await save(h,state);[h]=await read();
 assert.equal(h.state.cleaningAssignments[0].completedById,anna);
 await asUser(mark);
 assert.ok(Math.abs(Date.now()-Date.parse(h.state.cleaningAssignments[0].completedAt))<10000);
 state=structuredClone(h.state);state.cleaningAssignments=[];
 await assert.rejects(save(h,state),/Completed duties must be preserved/);
 state=structuredClone(h.state);state.members[0].id=outsider;
 await assert.rejects(save(h,state),/Invalid membership change/);
 // Automatic current/future duties can be redistributed by another household member.
 const currentWeek=(await db.query(`select to_char(clock_timestamp() at time zone 'Europe/Warsaw', 'IYYY-"W"IW') as week`)).rows[0].week;
 state=structuredClone(h.state);
 state.cleaningAssignments.push({...state.cleaningAssignments[0],id:'automatic',weekKey:currentWeek,status:'pending',manualOverride:false,completedAt:null,completedById:null});
 await save(h,state);[h]=await read();
 for (const modify of [
  a=>{a.id='replacement';},
  a=>{a.status='completed';},
  a=>{a.manualOverride=true;},
  a=>{a.completedById=mark;},
  a=>{a.assignedMemberId=outsider;a.assignedMemberName='Outsider';},
  a=>{a.zoneName='Forged';},
 ]) {
  const forged=structuredClone(h.state);modify(forged.cleaningAssignments.find(a=>a.id==='automatic'));
  await assert.rejects(save(h,forged),/OIKOS_OWN_CLEANING_ONLY/);
 }
 const optedOut=structuredClone(h.state);
 optedOut.members.find(m=>m.id===mark).includeInCleaning=false;
 Object.assign(optedOut.cleaningAssignments.find(a=>a.id==='automatic'),{assignedMemberId:mark,assignedMemberName:'Mark'});
 await assert.rejects(save(h,optedOut),/OIKOS_OWN_CLEANING_ONLY/);
 state=structuredClone(h.state);
 Object.assign(state.cleaningAssignments.find(a=>a.id==='automatic'),{assignedMemberId:mark,assignedMemberName:'Mark'});
 await save(h,state);[h]=await read();
 assert.equal(h.state.cleaningAssignments.find(a=>a.id==='automatic').assignedMemberId,mark);
 // Completion still requires the assignee; manual overrides stay protected.
 await asUser(anna);
 state=structuredClone(h.state);state.cleaningAssignments.find(a=>a.id==='automatic').status='completed';
 await assert.rejects(save(h,state),/OIKOS_OWN_CLEANING_ONLY/);
 await asUser(mark);
 state=structuredClone(h.state);state.cleaningAssignments.find(a=>a.id==='automatic').manualOverride=true;
 await save(h,state);[h]=await read();
 await asUser(anna);
 state=structuredClone(h.state);
 Object.assign(state.cleaningAssignments.find(a=>a.id==='automatic'),{assignedMemberId:anna,assignedMemberName:'Anna'});
 await assert.rejects(save(h,state),/OIKOS_OWN_CLEANING_ONLY/);
 await asUser(mark);
 // Explicit replanning releases a manual current/future duty without replacing its identity.
 await asUser(anna);
 state=structuredClone(h.state);
 Object.assign(state.cleaningAssignments.find(a=>a.id==='automatic'),{assignedMemberId:anna,assignedMemberName:'Anna',manualOverride:false});
 await save(h,state);[h]=await read();
 assert.equal(h.state.cleaningAssignments.find(a=>a.id==='automatic').assignedMemberId,anna);
 assert.equal(h.state.cleaningAssignments.find(a=>a.id==='automatic').manualOverride,false);
 await asUser(mark);
 // A shared zone can be retired without deleting history or completed evidence.
 const week=(await db.query(`select to_char(clock_timestamp() at time zone 'Europe/Warsaw', 'IYYY-"W"IW') as week`)).rows[0].week;
 state=structuredClone(h.state);
 state.cleaningZones.push({id:'retired',name:'Balkon',order:1});
 state.cleaningAssignments.push(
  {...state.cleaningAssignments[0],id:'future-other',zoneId:'retired',weekKey:week,status:'pending',completedAt:null,completedById:null},
  {...state.cleaningAssignments[0],id:'old-other',zoneId:'retired',weekKey:'2020-W01',status:'pending',completedAt:null,completedById:null}
 );
 await save(h,state);[h]=await read();
 state=structuredClone(h.state);state.cleaningZones=[];
 await save(h,state);[h]=await read();
 assert.ok(!h.state.cleaningAssignments.some(a=>a.id==='future-other'));
 assert.ok(h.state.cleaningAssignments.some(a=>a.id==='old-other'));
 assert.equal(h.state.cleaningAssignments.find(a=>a.id==='a').status,'completed');
 await db.query('select public.oikos_remove_member($1,$2)',[anna,h.revision]);[h]=await read();
 assert.equal(h.state.members.length,1);assert.equal(h.state.formerMembers[anna],'Anna');
 assert.equal(h.state.groceryExpenses.length,1);assert.equal(h.state.cleaningAssignments[0].assignedMemberId,anna);
 assert.notEqual(h.invite_token,firstInvite);
 await asUser(anna);assert.equal((await read()).length,0);
 await assert.rejects(db.query('select public.oikos_join_house($1,$2)',[firstInvite,'Anna']),/Invalid invitation/);
 } finally {await db.close();}
});

test('saved four-person household can redistribute a manual two-person plan into one zone each', async () => {
 const {buildRotationSchedule,regenerateSchedule}=await import('../src/lib/oikos.ts');
 const db=new PGlite();
 const ids=[anna,mark,outsider,'44444444-4444-4444-8444-444444444444'];
 try {
  await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
  for(const id of ids) await db.query('insert into auth.users values($1)',[id]);
  // The latest save function can upgrade an installation without intermediate save-function migrations.
  for(const file of ['202609180001_households.sql','202610090002_replan_cleaning_duties.sql']) {
   await db.exec(await readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'));
  }
  const asUser=async id=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
  const read=async()=>(await db.query('select * from public.oikos_households')).rows[0];
  const save=async(h,state)=>db.query('select public.oikos_save_house($1,$2,$3)',[h.id,h.revision,JSON.stringify(state)]);
  await asUser(ids[0]);await db.query('select public.oikos_create_house($1,$2)',['Four-person home','Person 1']);
  let h=await read();
  for(let i=1;i<ids.length;i++) {await asUser(ids[i]);await db.query('select public.oikos_join_house($1,$2)',[h.invite_token,`Person ${i+1}`]);}
  h=await read();
  const now=new Date();
  let state=structuredClone(h.state);
  state.cleaningZones=Array.from({length:4},(_,i)=>({id:`zone-${i}`,name:`Zone ${i+1}`,order:i}));
  state.cleaningAssignments=buildRotationSchedule({zones:state.cleaningZones,members:state.members.slice(0,2),startWeekDate:now,weeks:8})
   .map(a=>({...a,manualOverride:true}));
  await save(h,state);h=await read();
  state={...h.state,activeMemberId:ids[3]};
  state.cleaningAssignments=regenerateSchedule(state,now,8,true);
  await save(h,state);h=await read();
  for(const week of new Set(h.state.cleaningAssignments.map(a=>a.weekKey))) {
   const duties=h.state.cleaningAssignments.filter(a=>a.weekKey===week);
   assert.equal(duties.length,4);
   assert.equal(new Set(duties.map(a=>a.zoneId)).size,4);
   assert.deepEqual(new Set(duties.map(a=>a.assignedMemberId)),new Set(ids));
  }
 } finally {await db.close();}
});
