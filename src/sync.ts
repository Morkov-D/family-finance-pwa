import{db,setSetting}from './db';
import{api}from './api';
import type{Account,Budget,Debt,Goal,Loan,Member,Transaction,Recurring}from './domain';
export type CloudUser={id:string;name:string;role:'admin'|'member';email?:string;remind?:boolean;remindHour?:number};
export async function getProfiles(scriptUrl:string){const result=await api('profiles',{},'',scriptUrl);return (result.items||[]) as Pick<CloudUser,'id'|'name'|'role'>[]}
export async function cloudLogin(scriptUrl:string,memberId:string,pin:string){const result=await api('login',{memberId,pin},'',scriptUrl);return {token:String(result.token),user:result.user as CloudUser}}
/** Send mutations individually in order. Keep failed items in the outbox; do not silently mark them synced. */
export async function syncFamily(token:string,scriptUrl:string,userId:string){
 const priority:{[key:string]:number}={account:0,loan:1,budget:2,debt:2,goal:2,recurring:2,transaction:3,reminder:4,dayConfirm:5};const items=(await db.outbox.orderBy('createdAt').toArray()).sort((a,b)=>(priority[a.entity]??9)-(priority[b.entity]??9)||a.createdAt.localeCompare(b.createdAt));let uploaded=0;
 for(const item of items){
  const record=JSON.parse(item.record) as Record<string,unknown>;
  if(item.entity!=='budget'&&item.entity!=='reminder'&&record.ownerId!==userId&&record.actorId!==userId)continue;
  try{
   await api('syncRecord',{entity:item.entity,record},token,scriptUrl);
   await db.transaction('rw',db.outbox,db.transactions,async()=>{if(item.entity==='transaction')await db.transactions.update(item.id,{sync:'synced'});await db.outbox.delete(item.id)});
   uploaded++;
  }catch(error){await db.outbox.update(item.id,{attempts:item.attempts+1,error:String(error)});throw Error(`Не отправлена запись ${item.id.slice(0,8)}: ${String(error)}`)}
 }
 let cursor=0,pages=0,downloaded=0;
 do{
  const result=await api('snapshot',{cursor,limit:300},token,scriptUrl);
  if(cursor===0){
   await db.transaction('rw',db.members,db.accounts,db.budgets,db.loans,db.debts,db.goals,db.recurring,async()=>{
    const members=(result.members||[]) as Member[];const accounts=(result.accounts||[]) as Account[];
    const localMembers=await db.members.toArray();const byId=new Map(localMembers.map(m=>[m.id,m]));
    await db.members.bulkPut(members.map(m=>({...m,pinHash:byId.get(m.id)?.pinHash||'',pinSalt:byId.get(m.id)?.pinSalt||''}))); 
    await db.accounts.bulkPut(accounts);
    await db.budgets.bulkPut((result.budgets||[]) as Budget[]);
    await db.loans.bulkPut((result.credits||[]) as Loan[]);
    await db.debts.bulkPut((result.debts||[]) as Debt[]);
    await db.goals.bulkPut((result.goals||[]) as Goal[]);
    await db.recurring.bulkPut((result.recurring||[]) as Recurring[]);
   });
   for(const day of (result.confirmedDays||[]) as string[])await setSetting('dayConfirmed:'+userId+':'+day,'true');
  }
  const transactions=(result.transactions||[]) as Transaction[];
  await db.transactions.bulkPut(transactions);
  downloaded+=transactions.length;cursor=Number(result.nextCursor)||0;pages++;
  if(pages>300)throw Error('Слишком много страниц синхронизации');
 }while(cursor>0);
 return{uploaded,downloaded};
}
export async function queueEntity<T extends {id:string}>(entity:'account'|'budget'|'loan'|'debt'|'goal'|'recurring'|'reminder'|'dayConfirm',record:T){
 await db.outbox.put({id:record.id,entity,record:JSON.stringify(record),createdAt:new Date().toISOString(),attempts:0});
}
