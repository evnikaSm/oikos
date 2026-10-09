import test from 'node:test';
import assert from 'node:assert/strict';
import { demoState, getMonthlyContributed, getMonthlySpent, parseMoneyAmount, removeOwnExpense } from '../src/lib/oikos.ts';

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
