import {test} from 'node:test';
import assert from 'node:assert/strict';
import {balance,accountTotals,monthly,parseMoney,loanMonths,nextRecurringDate,categorySummary} from '../src/domain.ts';
const base={type:'debit',ownerId:'u1',shared:true,opening:100000,createdAt:'2026-01-01'};
const a={...base,id:'a',name:'Банк'};const b={...base,id:'b',name:'Наличные',opening:1000};
const operation={id:'tx',type:'transfer',accountId:'a',targetAccountId:'b',amount:30000,date:'2026-11-12',category:'Перевод',note:'',actorId:'u1',ownerId:'u1',createdAt:'2026-11-12T08:00:00Z',sync:'synced'};
test('money parsing uses exact integer kopecks',()=>{assert.equal(parseMoney('12 345,67'),1234567);assert.equal(parseMoney('0,01'),1);assert.equal(parseMoney('2.345'),null);assert.equal(parseMoney('0'),null)});
test('transfers do not change family capital or income/expense',()=>{const totals=accountTotals([a,b],[operation]);assert.equal(totals.assets,101000);assert.equal(balance(a,[operation]),70000);assert.equal(balance(b,[operation]),31000);assert.deepEqual([monthly([operation],'2026-11').income,monthly([operation],'2026-11').expense],[0,0])});
test('debt accounts are liabilities, credit spending increases the debt',()=>{const credit={...a,id:'c',type:'credit',opening:-50000};const expense={...operation,id:'buy',type:'expense',accountId:'c',targetAccountId:undefined,amount:12000,category:'Продукты'};const totals=accountTotals([a,credit],[expense]);assert.equal(totals.liabilities,-62000);assert.equal(totals.assets,100000)});
test('expense categories never include transfers',()=>{const expense={...operation,id:'e',type:'expense',targetAccountId:undefined,amount:2000,category:'Продукты'};assert.deepEqual(categorySummary([operation,expense],'2026-11'),[{name:'Продукты',value:2000}])});
test('monthly payment estimate detects non-amortizing loans',()=>{assert.equal(loanMonths(100000,0,10000),10);assert.equal(loanMonths(100000,12,1000),Infinity)});
test('recurring dates handle week, end of month and once',()=>{assert.equal(nextRecurringDate('2026-01-31','monthly'),'2026-02-28');assert.equal(nextRecurringDate('2026-11-12','weekly'),'2026-11-19');assert.equal(nextRecurringDate('2026-11-12','once'),'')});

test('end-of-month recurrence restores original anchor',()=>{assert.equal(nextRecurringDate('2026-02-28','monthly',31),'2026-03-31')});
