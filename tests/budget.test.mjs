import test from 'node:test';
import assert from 'node:assert/strict';
import { demoState, getMonthlyContributed, getMonthlySpent, parseMoneyAmount } from '../src/lib/oikos.ts';

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
