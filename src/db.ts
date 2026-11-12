import Dexie,{type Table} from 'dexie';
import type{Account,Budget,Debt,Goal,Loan,Member,Transaction,Recurring}from './domain';
export type Setting={key:string;value:string};
export type Pending={id:string;entity:'transaction'|'account'|'budget'|'loan'|'debt'|'goal'|'recurring'|'reminder'|'dayConfirm';record:string;createdAt:string;attempts:number;error?:string};
class FinanceDB extends Dexie {
 members!:Table<Member,string>;accounts!:Table<Account,string>;transactions!:Table<Transaction,string>;budgets!:Table<Budget,string>;loans!:Table<Loan,string>;recurring!:Table<Recurring,string>;debts!:Table<Debt,string>;goals!:Table<Goal,string>;settings!:Table<Setting,string>;outbox!:Table<Pending,string>;
 constructor(){super('family-finance-product-v1');this.version(1).stores({members:'id',accounts:'id,ownerId,type',transactions:'id,date,actorId,accountId,type',budgets:'id,month',loans:'id,ownerId',debts:'id,ownerId',goals:'id,ownerId',settings:'key',outbox:'id,createdAt'});this.version(2).stores({recurring:'id,ownerId,nextDate'})}
}
export const db=new FinanceDB();
export async function setting(key:string,fallback=''){return (await db.settings.get(key))?.value||fallback}
export async function setSetting(key:string,value:string){await db.settings.put({key,value})}
export async function saveTransaction(t:Transaction){await db.transaction('rw',db.transactions,db.outbox,async()=>{await db.transactions.add(t);await db.outbox.put({id:t.id,entity:'transaction',record:JSON.stringify(t),createdAt:t.createdAt,attempts:0})})}
