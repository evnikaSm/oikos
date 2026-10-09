import test from 'node:test';
import assert from 'node:assert/strict';
import { demoState, buildRotationSchedule, regenerateSchedule, formatWeekKey, monthDays, toggleCleaningParticipation, setCleaningCompletion, canChangeCleaningCompletion } from '../src/lib/oikos.ts';
test('rotation covers every zone and rotates participants', () => {
 const result = buildRotationSchedule({ zones: demoState.cleaningZones, members: demoState.members, startWeekDate: new Date(2026,8,14), weeks: 4 });
 assert.equal(result.length, 12);
 assert.notEqual(result[0].assignedMemberId, result[3].assignedMemberId);
 assert.equal(buildRotationSchedule({ zones: [], members: demoState.members, startWeekDate: new Date() }).length,0);
});
test('regeneration preserves history, completion timestamp and manual assignments without duplicate slots', () => {
 const initial = buildRotationSchedule({ zones: demoState.cleaningZones, members: demoState.members, startWeekDate: new Date(2026,8,7), weeks: 4 });
 initial[3] = {...initial[3], status:'completed', completedAt:'2026-09-15T16:42:13.123Z'};
 initial[4].manualOverride = true;
 const next = regenerateSchedule({...demoState, cleaningAssignments:initial},new Date(2026,8,15),8);
 for (const item of [...initial.slice(0,3),initial[3],initial[4]]) assert.deepEqual(next.find(a=>a.id===item.id),item);
 assert.equal(new Set(next.map(a=>a.weekKey+':'+a.zoneId)).size,next.length);
});
test('calendar handles leap years, complete rows and ISO year boundaries', () => {
 const days=monthDays(new Date(2024,1,1));
 assert.equal(days.length%7,0); assert.equal(days[0].getDay(),1);
 assert.equal(days.filter(d=>d.getMonth()===1).length,29);
 assert.equal(formatWeekKey(new Date(2021,0,1)), '2020-W53');
});

test('regeneration redistributes a two-person schedule across all selected participants', () => {
 const now=new Date(2026,8,14);
 const initial=buildRotationSchedule({zones:demoState.cleaningZones,members:demoState.members.slice(0,2),startWeekDate:now,weeks:8});
 for (const activeMemberId of demoState.members.map(m=>m.id)) {
  const next=regenerateSchedule({...demoState,activeMemberId,cleaningAssignments:initial},now,8);
  assert.deepEqual(new Set(next.map(a=>a.assignedMemberId)),new Set(demoState.members.map(m=>m.id)));
  for (const member of demoState.members) assert.equal(next.filter(a=>a.assignedMemberId===member.id).length,8);
  assert.deepEqual(new Set(next.map(a=>a.id)),new Set(initial.map(a=>a.id)));
  assert.equal(new Set(next.map(a=>a.weekKey+':'+a.zoneId)).size,next.length);
 }
});

test('rotation includes everyone when there are fewer zones than people', () => {
 const members=Array.from({length:8},(_,i)=>({...demoState.members[0],id:`member-${i}`}));
 const result=buildRotationSchedule({zones:demoState.cleaningZones.slice(0,2),members,startWeekDate:new Date(2026,8,14),weeks:4});
 assert.equal(result.length,8);
 assert.equal(new Set(result.map(a=>a.assignedMemberId)).size,8);
});

test('participation changes refresh the entire existing schedule and exclude opted-out members', () => {
 const now=new Date(2026,8,14);
 const members=demoState.members.map((m,i)=>({...m,includeInCleaning:i<2}));
 const initial=buildRotationSchedule({zones:demoState.cleaningZones,members,startWeekDate:now,weeks:52});
 const next=toggleCleaningParticipation({...demoState,members,cleaningAssignments:initial},members[2].id,now,4);
 assert.equal(next.cleaningAssignments.length,156);
 for(const member of next.members) assert.equal(next.cleaningAssignments.filter(a=>a.assignedMemberId===member.id).length,52);
 const excluded=toggleCleaningParticipation(next,members[0].id,now,4);
 assert.ok(excluded.cleaningAssignments.every(a=>a.assignedMemberId!==members[0].id));
 let empty=excluded;
 for(const member of empty.members.filter(m=>m.includeInCleaning)) empty=toggleCleaningParticipation(empty,member.id,now,4);
 assert.ok(empty.cleaningAssignments.every(a=>a.assignedMemberId===null));
});

test('fixed duties count toward workloads and regeneration is stable', () => {
 const now=new Date(2026,8,14);
 const initial=buildRotationSchedule({zones:demoState.cleaningZones,members:demoState.members,startWeekDate:now,weeks:4});
 initial[0].manualOverride=true;
 initial[1]={...initial[1],status:'completed',completedAt:'2026-09-14T12:00:00Z'};
 const state={...demoState,cleaningAssignments:initial};
 const next=regenerateSchedule(state,now,4);
 assert.deepEqual(next.find(a=>a.id===initial[0].id),initial[0]);
 assert.deepEqual(next.find(a=>a.id===initial[1].id),initial[1]);
 for(const member of state.members) assert.equal(next.filter(a=>a.assignedMemberId===member.id).length,4);
 assert.deepEqual(regenerateSchedule({...state,cleaningAssignments:next},now,4),next);
});

test('deleted zones disappear from regenerated pending schedules, including manual and other-member duties', () => {
 const initial=buildRotationSchedule({zones:demoState.cleaningZones,members:demoState.members,startWeekDate:new Date(2026,8,7),weeks:12});
 initial[3]={...initial[3],status:'completed',completedAt:'2026-09-15T10:00:00Z'};
 initial[7].manualOverride=true;
 const next=regenerateSchedule({...demoState,cleaningZones:[],cleaningAssignments:initial},new Date(2026,8,15),4);
 assert.deepEqual(next, [...initial.slice(0,3),initial[3]]);
});

test('future manual duties cannot leave a participant out of a fully staffed week', () => {
 const now=new Date(2026,8,14);
 const initial=buildRotationSchedule({zones:demoState.cleaningZones,members:demoState.members,startWeekDate:now,weeks:8});
 const fixed=initial.filter(a=>a.weekKey!==formatWeekKey(now)).map(a=>({...a,assignedMemberId:'mark',assignedMemberName:'Mark',manualOverride:true}));
 const next=regenerateSchedule({...demoState,cleaningAssignments:fixed},now,8);
 const thisWeek=next.filter(a=>a.weekKey===formatWeekKey(now));
 assert.equal(thisWeek.length,3);
 assert.deepEqual(new Set(thisWeek.map(a=>a.assignedMemberId)),new Set(demoState.members.map(m=>m.id)));
 for(const duty of fixed) assert.deepEqual(next.find(a=>a.id===duty.id),duty);
});

test('new planning windows continue the rotation instead of restarting with the same people', () => {
 let state={...demoState,cleaningZones:demoState.cleaningZones.slice(0,1),cleaningAssignments:[]};
 const assigned=[];
 for(let week=0;week<6;week++) {
  const now=new Date(2026,8,14+week*7);
  state={...state,cleaningAssignments:regenerateSchedule(state,now,1)};
  const current=state.cleaningAssignments.filter(a=>a.weekKey===formatWeekKey(now));
  assert.equal(current.length,1);
  assigned.push(current[0].assignedMemberId);
 }
 assert.equal(new Set(assigned.slice(0,3)).size,3);
 assert.equal(new Set(assigned.slice(3,6)).size,3);
});

test('explicit redistribution gives four people one of four zones even after manual two-person assignments', () => {
 const now=new Date(2026,8,14);
 const members=[...demoState.members,{...demoState.members[0],id:'fourth',name:'Fourth'}];
 const zones=[...demoState.cleaningZones,{id:'fourth-zone',name:'Fourth zone',order:3}];
 const initial=buildRotationSchedule({zones,members:members.slice(0,2),startWeekDate:now,weeks:8})
  .map(a=>({...a,manualOverride:true}));
 const state={...demoState,members,cleaningZones:zones,cleaningAssignments:initial};
 const next=regenerateSchedule(state,now,8,true);
 assert.deepEqual(new Set(next.map(a=>a.id)),new Set(initial.map(a=>a.id)));
 for(const week of new Set(next.map(a=>a.weekKey))) {
  const duties=next.filter(a=>a.weekKey===week);
  assert.equal(duties.length,4);
  assert.equal(new Set(duties.map(a=>a.zoneId)).size,4);
  assert.deepEqual(new Set(duties.map(a=>a.assignedMemberId)),new Set(members.map(m=>m.id)));
 }
 assert.ok(next.every(a=>!a.manualOverride));
 assert.deepEqual(regenerateSchedule({...state,cleaningAssignments:next},now,8,true),next);
});

test('explicit redistribution preserves completed duties and past manual assignments', () => {
 const start=new Date(2026,8,7), now=new Date(2026,8,14);
 const initial=buildRotationSchedule({zones:demoState.cleaningZones,members:demoState.members,startWeekDate:start,weeks:4})
  .map(a=>({...a,manualOverride:true}));
 initial[3]={...initial[3],status:'completed',completedAt:'2026-09-14T12:00:00Z',completedById:initial[3].assignedMemberId};
 const next=regenerateSchedule({...demoState,cleaningAssignments:initial},now,4,true);
 for(const duty of [...initial.slice(0,3),initial[3]]) assert.deepEqual(next.find(a=>a.id===duty.id),duty);
});

test('extra zones are divided across all participants with weekly workloads differing by at most one', () => {
 const zones=Array.from({length:7},(_,i)=>({id:`zone-${i}`,name:`Zone ${i}`,order:i}));
 const next=buildRotationSchedule({zones,members:demoState.members,startWeekDate:new Date(2026,8,14),weeks:8});
 for(const week of new Set(next.map(a=>a.weekKey))) {
  const duties=next.filter(a=>a.weekKey===week);
  const counts=demoState.members.map(m=>duties.filter(a=>a.assignedMemberId===m.id).length);
  assert.equal(duties.length,7);
  assert.ok(Math.max(...counts)-Math.min(...counts)<=1);
 }
});


test('own completion can be cleared and confirmed again without changing the duty', () => {
 const initial=buildRotationSchedule({zones:demoState.cleaningZones,members:demoState.members,startWeekDate:new Date(2026,8,14),weeks:1});
 const duty=initial[0];
 const state={...demoState,activeMemberId:duty.assignedMemberId,cleaningAssignments:initial};
 const done=setCleaningCompletion(state,duty.id,true,new Date('2026-09-14T12:00:00Z'));
 assert.equal(done.cleaningAssignments[0].completedById,state.activeMemberId);
 assert.equal(canChangeCleaningCompletion(done.cleaningAssignments[0],state.activeMemberId),true);
 const undone=setCleaningCompletion(done,duty.id,false);
 assert.deepEqual(undone,state);
 const redone=setCleaningCompletion(undone,duty.id,true,new Date('2026-09-14T13:00:00Z'));
 assert.equal(redone.cleaningAssignments[0].completedAt,'2026-09-14T13:00:00.000Z');
 assert.deepEqual(setCleaningCompletion(redone,duty.id,true),redone);
 const other={...done,activeMemberId:'someone-else'};
 assert.equal(canChangeCleaningCompletion(done.cleaningAssignments[0],other.activeMemberId),false);
 assert.deepEqual(setCleaningCompletion(other,duty.id,false),other);
 const pendingOther={...state,activeMemberId:'someone-else'};
 assert.deepEqual(setCleaningCompletion(pendingOther,duty.id,true),pendingOther);
});
