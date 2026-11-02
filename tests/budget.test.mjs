import test from 'node:test';
import assert from 'node:assert/strict';
import { demoState, resetRemainingBudget, resetBudgetPeriod, getRemainingBudget, getMonthlyContributed, getMonthlySpent, parseMoneyAmount, removeOwnExpense } from '../src/lib/oikos.ts';

test('all entered contributions count, independently of confirmation', () => {
 const members=demoState.members.map((m,i)=>({...m,contributionAmount:[100,200,0][i],contributionStatus:'unpaid'}));
 assert.equal(getMonthlyContributed(members),300);
 assert.equal(getMonthlyContributed(members.map(m=>({...m,contributionStatus:'paid'}))),300);
 assert.equal(getMonthlyContributed(members)-getMonthlySpent([{amount:75}]),225);
 assert.equal(getMonthlyContributed([]),0);
 assert.equal(getMonthlyContributed([{contributionAmount:0.1},{contributionAmount:0.2}]),0.3);
});
test('contribution input accepts zero and Polish decimals; rejects invalid amounts', () => {
 assert.equal(parseMoneyAmount('0'),0);
 assert.equal(parseMoneyAmount(' 125,50 '),125.5);
 assert.equal(parseMoneyAmount('42.75'),42.75);
 for (const input of ['', '-1', 'NaN', 'Infinity', '1e3', '1.234', '12abc']) assert.equal(parseMoneyAmount(input),null);
});


test('decimal expenses sum exactly to cents', () => {
 assert.equal(getMonthlySpent([{amount:0.1},{amount:0.2}]),0.3);
 assert.equal(getMonthlySpent([{amount:parseMoneyAmount('7,80')},{amount:parseMoneyAmount('42.75')}]),50.55);
 assert.equal(parseMoneyAmount('0,01'),0.01);
});

test('removing your manual or trip expense updates spending and keeps purchase history', () => {
 for(const expense of demoState.groceryExpenses) {
  const state={...demoState,activeMemberId:expense.purchaserId};
  const next=removeOwnExpense(state,expense.id);
  assert.equal(next.groceryExpenses.length,state.groceryExpenses.length-1);
  assert.equal(next.groceryExpenses.some(e=>e.id===expense.id),false);
  assert.equal(getMonthlySpent(next.groceryExpenses),Math.round((getMonthlySpent(state.groceryExpenses)-expense.amount)*100)/100);
  assert.deepEqual(next.shoppingTrips,state.shoppingTrips);
  assert.deepEqual(next.shoppingItems,state.shoppingItems);
  const other={...state,activeMemberId:'someone-else'};
  assert.deepEqual(removeOwnExpense(other,expense.id),other);
 }
 assert.deepEqual(removeOwnExpense(demoState,'missing'),demoState);
});


test('period reset carries balance, preserves history and counts only new activity', () => {
 for (const amount of [500, 0, 10.25]) {
  const state=structuredClone(demoState);
  state.members=state.members.map((m,i)=>({...m,contributionAmount:i===0?amount:0}));
  state.groceryExpenses=[{...demoState.groceryExpenses[0],id:'old',amount:42.75}];
  const balance=getRemainingBudget(state);
  const next=resetBudgetPeriod(state);
  assert.equal(next.monthlyBudget.budgetAmount,0);
  assert.equal(getMonthlyContributed(next.members),0);
  assert.equal(getMonthlySpent(next.groceryExpenses,next.monthlyBudget),0);
  assert.equal(getRemainingBudget(next),balance);
  assert.deepEqual(next.groceryExpenses,state.groceryExpenses);
  assert.deepEqual(next.shoppingTrips,state.shoppingTrips);
  assert.deepEqual(resetBudgetPeriod(next),next);
  next.members[0].contributionAmount=100.5;
  next.groceryExpenses.push({...next.groceryExpenses[0],id:'new',amount:12.25});
  assert.equal(getMonthlySpent(next.groceryExpenses,next.monthlyBudget),12.25);
  assert.equal(getRemainingBudget(next),Math.round((balance+88.25)*100)/100);
  assert.equal(getRemainingBudget(resetBudgetPeriod(next)),getRemainingBudget(next));
 }
});


test('separate balance reset preserves all other data and tracks subsequent activity', () => {
 for (const carryOver of [0,125.5,-500]) {
  const state={...demoState,monthlyBudget:{...demoState.monthlyBudget,carryOver}};
  const next=resetRemainingBudget(state);
  assert.equal(getRemainingBudget(next),0);
  assert.deepEqual({...next,monthlyBudget:state.monthlyBudget},state);
  assert.deepEqual(resetRemainingBudget(next),next);
  assert.equal(getRemainingBudget({...next,members:next.members.map((m,i)=>i===0?{...m,contributionAmount:m.contributionAmount+100}:m)}),100);
  assert.equal(getRemainingBudget({...next,groceryExpenses:[...next.groceryExpenses,{...next.groceryExpenses[0],id:'new',amount:12.25}]}),-12.25);
  assert.equal(getRemainingBudget(resetBudgetPeriod(next)),0);
 }
});
