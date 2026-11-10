export type Member={id:string;name:string;role:'admin'|'member';pinSalt:string;pinHash:string;email:string;remind:boolean;remindHour:number;createdAt:string};
export type AccountType='debit'|'cash'|'savings'|'credit'|'loan';
export type Account={id:string;name:string;type:AccountType;ownerId:string;shared:boolean;opening:number;createdAt:string;bank?:string};
export type OperationType='expense'|'income'|'transfer';
export type Transaction={id:string;type:OperationType;accountId:string;targetAccountId?:string;amount:number;category:string;note:string;date:string;actorId:string;ownerId:string;createdAt:string;sync:'local'|'synced'|'conflict'};
export type Budget={id:string;month:string;category:string;limit:number};
export type Loan={id:string;name:string;ownerId:string;accountId?:string;principal:number;remaining:number;annualRate:number;payment:number;dueDay:number;kind:'loan'|'card';creditLimit?:number};
export type Debt={id:string;name:string;ownerId:string;direction:'owed'|'receivable';amount:number;remaining:number;dueDate:string};
export type Goal={id:string;name:string;ownerId:string;target:number;saved:number;deadline:string};
export const id=()=>crypto.randomUUID();
export const localDay=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const monthOf=(day:string)=>day.slice(0,7);
export const fmt=(k:number)=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:2}).format(k/100);
export const compact=(k:number)=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(k/100);
export function parseMoney(raw:string):number|null {const m=raw.trim().replace(/\s/g,'').replace(',','.').match(/^(\d{1,10})(?:\.(\d{1,2}))?$/);if(!m)return null;const n=Number(m[1])*100+Number((m[2]||'').padEnd(2,'0'));return Number.isSafeInteger(n)&&n>0?n:null}
export const signed=(type:OperationType,amount:number)=>type==='income'?amount:type==='expense'?-amount:0;
export function balance(a:Account,txs:Transaction[]){return a.opening+txs.reduce((s,t)=>s+(t.accountId===a.id?(t.type==='income'?t.amount:-t.amount):0)+(t.type==='transfer'&&t.targetAccountId===a.id?t.amount:0),0)}
export function accountTotals(accounts:Account[],txs:Transaction[]){const rows=accounts.map(a=>({...a,balance:balance(a,txs)}));return {rows,assets:rows.filter(a=>!['loan','credit'].includes(a.type)).reduce((s,a)=>s+a.balance,0),liabilities:rows.filter(a=>['loan','credit'].includes(a.type)).reduce((s,a)=>s+Math.min(a.balance,0),0)}}
export const expenseCategories=['Продукты','Жильё','Транспорт','Здоровье','Кафе','Покупки','Развлечения','Подписки','Образование','Подарки','Проценты и комиссии','Другое'];
export const incomeCategories=['Зарплата','Аванс','Премия','Подработка','Проценты по вкладу','Подарок','Другое'];
export function monthly(txs:Transaction[],month:string){const items=txs.filter(t=>t.date.startsWith(month));return {income:items.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0),expense:items.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0),items}}
export function categorySummary(txs:Transaction[],month:string){const r=new Map<string,number>();txs.filter(t=>t.type==='expense'&&t.date.startsWith(month)).forEach(t=>r.set(t.category,(r.get(t.category)||0)+t.amount));return [...r].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value)}
export const isVisible=(account:Account,member:Member)=>account.shared||account.ownerId===member.id;
export function loanMonths(principal:number,rate:number,payment:number){if(principal<=0)return 0;const i=rate/1200;if(payment<=principal*i)return Infinity;return i===0?Math.ceil(principal/payment):Math.ceil(-Math.log(1-principal*i/payment)/Math.log(1+i))}
export function nextDue(day:number,now=new Date()){const d=new Date(now.getFullYear(),now.getMonth(),Math.min(day,new Date(now.getFullYear(),now.getMonth()+1,0).getDate()));if(d.getTime()<new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime())return new Date(now.getFullYear(),now.getMonth()+1,Math.min(day,new Date(now.getFullYear(),now.getMonth()+2,0).getDate()));return d}
export async function derivePin(pin:string,salt:string){const bytes=new TextEncoder().encode(pin);const key=await crypto.subtle.importKey('raw',bytes,'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:Uint8Array.from(salt.match(/.{2}/g)!.map(x=>parseInt(x,16))),iterations:210000,hash:'SHA-256'},key,256);return [...new Uint8Array(bits)].map(n=>n.toString(16).padStart(2,'0')).join('')}
export function salt(){return [...crypto.getRandomValues(new Uint8Array(16))].map(n=>n.toString(16).padStart(2,'0')).join('')}
export const safeText=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
