import Dexie,{type Table} from 'dexie';
export type Tx={id:string;type:'income'|'expense';amountKopecks:number;category:string;account:string;comment:string;createdAt:string;author:string;syncStatus:'local'};
class FinanceDB extends Dexie{transactions!:Table<Tx,string>;settings!:Table<{key:string;value:string},string>;constructor(){super('family-finance-v1');this.version(1).stores({transactions:'id,createdAt,type',settings:'key'})}}
export const db=new FinanceDB();
export const getSetting=async(k:string)=>(await db.settings.get(k))?.value||'';
export const setSetting=(k:string,value:string)=>db.settings.put({key:k,value});
