import test from 'node:test';
import assert from 'node:assert/strict';
import { demoState, buildRotationSchedule, regenerateSchedule, formatWeekKey, monthDays } from '../src/lib/oikos.ts';
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

test('regeneration cannot edit or replace another member’s pending duties', () => {
 const initial=buildRotationSchedule({zones:demoState.cleaningZones,members:demoState.members,startWeekDate:new Date(2026,8,14),weeks:4});
 const state={...demoState,activeMemberId:'anna',cleaningAssignments:initial};
 const next=regenerateSchedule(state,new Date(2026,8,15),8);
 for(const assignment of initial.filter(a=>a.assignedMemberId!=='anna')) assert.deepEqual(next.find(a=>a.id===assignment.id),assignment);
 assert.equal(new Set(next.map(a=>a.weekKey+':'+a.zoneId)).size,next.length);
 assert.ok(next.length>initial.length,'new weeks can still be scheduled');
});

test('deleted zones disappear from regenerated pending schedules, including manual and other-member duties', () => {
 const initial=buildRotationSchedule({zones:demoState.cleaningZones,members:demoState.members,startWeekDate:new Date(2026,8,7),weeks:12});
 initial[3]={...initial[3],status:'completed',completedAt:'2026-09-15T10:00:00Z'};
 initial[7].manualOverride=true;
 const next=regenerateSchedule({...demoState,cleaningZones:[],cleaningAssignments:initial},new Date(2026,8,15),4);
 assert.deepEqual(next, [...initial.slice(0,3),initial[3]]);
});
