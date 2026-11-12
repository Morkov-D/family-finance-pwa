/** V2 record replication: Apps Script remains the authority for identity, ACL and idempotency. */
function ftext_(v,max){const s=String(v===undefined||v===null?'':v).trim().slice(0,max);return /^[=+@\t\r]/.test(s)?"'"+s:s}
function fdatestr_(d){return Object.prototype.toString.call(d)==='[object Date]'?Utilities.formatDate(d,PropertiesService.getScriptProperties().getProperty('FAMILY_TIMEZONE')||Session.getScriptTimeZone(),'yyyy-MM-dd'):String(d)}
function fdate_(d){fcheck_(typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d,'Invalid date');return d}
function fint_(v,min,max){fcheck_(typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max,'Invalid amount');return v}
function flist_(type,m){return frows_(type).filter(x=>!x.owner_id||String(x.owner_id)===String(m.id)||type==='Budgets')}
function fcreateMemberV2_(m,d){return fmutex_(()=>{
 fcheck_(m.role==='admin','Admin required');fvalidateId_(d.id);
 const pin=String(d.pin||'');fcheck_(/^\d{6}$/.test(pin),'PIN must be six digits');
 const name=ftext_(d.name,80);fcheck_(name.length>=2,'Name required');
 const email=ftext_(d.email||'',150);fcheck_(!email||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Invalid email');
 if(frows_('FamilyMembers').some(x=>String(x.id)===d.id))throw Error('Member already exists');
 const salt=Utilities.getUuid();fappend_('FamilyMembers',{id:d.id,name,role:'member',status:'active',pin_salt:salt,pin_hash:fhash_(pin,salt),email,remind_enabled:false,remind_hour:20,created_at:new Date().toISOString()});
 fappend_('AuditLog',{id:Utilities.getUuid(),actor_id:m.id,action:'create',entity:'Member',entity_id:d.id,at:new Date().toISOString(),details:'new member'});
 return{ok:true,id:d.id};
})}
function fsnapshotV2_(m,data){
 const cursor=Math.max(0,Number(data.cursor)||0),limit=Math.min(500,Math.max(1,Number(data.limit)||250));
 const accounts=frows_('Accounts').filter(a=>String(a.status)==='active'&&fcan_(m,a));
 const allowed=new Set(accounts.map(a=>String(a.id)));
 const all=frows_('Transactions').filter(t=>String(t.status)==='posted'&&(allowed.has(String(t.account_id))||allowed.has(String(t.target_account_id))));
 const transactions=all.slice(cursor,cursor+limit).map(t=>({id:String(t.id),type:String(t.type),accountId:String(t.account_id),targetAccountId:String(t.target_account_id||'')||undefined,amount:Number(t.amount),category:String(t.category||''),note:String(t.comment||''),date:fdatestr_(t.date),actorId:String(t.actor_id),ownerId:String(t.owner_id),createdAt:String(t.created_at),sync:'synced'}));
 const payload={ok:true,transactions,nextCursor:cursor+limit<all.length?cursor+limit:0};
 if(cursor>0)return payload;
 payload.accounts=accounts.map(a=>({id:String(a.id),ownerId:String(a.owner_id),name:String(a.name),type:String(a.type),shared:String(a.shared)==='true',opening:Number(a.opening_balance)||0,createdAt:String(a.created_at),bank:''}));
 payload.members=frows_('FamilyMembers').filter(x=>x.status==='active').map(x=>({id:String(x.id),name:String(x.name),role:x.role,email:x.id===m.id?String(x.email||''):'',remind:x.id===m.id?String(x.remind_enabled)==='true':false,remindHour:Number(x.remind_hour)||20,createdAt:String(x.created_at),pinSalt:'',pinHash:''}));
 payload.confirmedDays=frows_('DayConfirmations').filter(x=>String(x.member_id)===String(m.id)).slice(-60).map(x=>fdatestr_(x.day));
 payload.budgets=frows_('Budgets').map(x=>({id:String(x.id),month:String(x.month),category:String(x.category),limit:Number(x.limit_amount)}));
 payload.credits=flist_('Credits',m).map(x=>({id:String(x.id),ownerId:String(x.owner_id),accountId:String(x.account_id),name:String(x.name),principal:Number(x.principal),remaining:Number(x.remaining),annualRate:Number(x.rate),payment:Number(x.payment),dueDay:Number(x.due_day),kind:String(x.kind),creditLimit:x.credit_limit===''?undefined:Number(x.credit_limit)}));
 payload.debts=flist_('Debts',m).map(x=>({id:String(x.id),ownerId:String(x.owner_id),name:String(x.name),direction:String(x.direction),amount:Number(x.amount),remaining:Number(x.remaining),dueDate:String(x.due_date||'')}));
 payload.recurring=frows_('Recurring').filter(x=>String(x.owner_id)===String(m.id)||allowed.has(String(x.account_id))).map(x=>({id:String(x.id),ownerId:String(x.owner_id),name:String(x.name),accountId:String(x.account_id),type:String(x.type),category:String(x.category),amount:Number(x.amount),nextDate:fdatestr_(x.next_date),frequency:String(x.frequency),enabled:String(x.enabled)==='true',dayOfMonth:Number(x.day_of_month)||0}));
 payload.goals=flist_('Goals',m).map(x=>({id:String(x.id),ownerId:String(x.owner_id),name:String(x.name),target:Number(x.target),saved:Number(x.saved),deadline:String(x.deadline||'')}));
 return payload;
}
function fupsertV2_(m,d){return fmutex_(()=>{
 fcheck_(d&&typeof d==='object'&&d.record&&typeof d.entity==='string','Invalid record');const kind=d.entity,r=d.record;
 fcheck_(['account','budget','loan','debt','goal','recurring','reminder','dayConfirm'].includes(kind),'Invalid entity');
 if(kind==='dayConfirm'){
  const day=fdate_(r.day);fcheck_(String(r.id)===String(m.id)+':'+day,'Invalid day confirmation');
  if(!frows_('DayConfirmations').some(x=>String(x.id)===r.id))fappend_('DayConfirmations',{id:r.id,member_id:m.id,day,confirmed_at:new Date().toISOString()});
  return{ok:true,id:r.id};
 }
 if(kind==='reminder'){
  fcheck_(String(r.id)==='reminder:'+String(m.id),'Invalid reminder owner');
  const hour=Number(r.hour),enabled=!!r.enabled,email=ftext_(r.email||m.email||'',150);
  fcheck_(Number.isInteger(hour)&&hour>=8&&hour<=23,'Invalid reminder hour');
  fcheck_(!enabled||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Email required');
  const tz=String(r.timezone||'').trim();fcheck_(!tz||/^[A-Za-z_]+(?:\/[A-Za-z_+-]+){0,3}$/.test(tz),'Invalid timezone');
  fmodify_('FamilyMembers',m.id,{remind_enabled:enabled,remind_hour:hour,email,timezone:tz||Session.getScriptTimeZone()});return{ok:true,id:r.id};
 }
 if(kind==='budget'){
  const month=String(r.month||'');fcheck_(/^\d{4}-(0[1-9]|1[0-2])$/.test(month),'Invalid month');
  const category=ftext_(r.category,90);fcheck_(category.length>0,'Category required');
  const limit=fint_(r.limit,0,1e12),id=month+':'+category;
  fcheck_(String(r.id)===id,'Invalid budget ID');
  const row=frows_('Budgets').find(x=>String(x.id)===id);
  if(row)fmodify_('Budgets',id,{limit_amount:limit});
  else fappend_('Budgets',{id,month,category,limit_amount:limit,owner_id:m.id});
  return{ok:true,id};
 }
 fvalidateId_(r.id);
 const sheets={account:'Accounts',loan:'Credits',debt:'Debts',goal:'Goals',recurring:'Recurring'};const table=sheets[kind];
 const exists=frows_(table).find(x=>String(x.id)===String(r.id));
 if(exists){fcheck_(String(exists.owner_id)===String(m.id),'Record not owned by user');
  if(kind==='recurring'){const account=frows_('Accounts').find(a=>String(a.id)===String(exists.account_id)&&a.status==='active');fcheck_(fcan_(m,account),'Account not accessible');fmodify_('Recurring',r.id,{next_date:r.nextDate?fdate_(r.nextDate):'',enabled:!!r.enabled});return{ok:true,id:r.id,updated:true}}
  if(kind==='debt'){const remaining=fint_(r.remaining,0,Number(exists.amount));fmodify_('Debts',r.id,{remaining});fappend_('AuditLog',{id:Utilities.getUuid(),actor_id:m.id,action:'update',entity:'Debt',entity_id:r.id,at:new Date().toISOString(),details:'remaining changed'});return{ok:true,id:r.id,updated:true}}
  if(kind==='goal'){const saved=fint_(r.saved,0,1e12);fmodify_('Goals',r.id,{saved});fappend_('AuditLog',{id:Utilities.getUuid(),actor_id:m.id,action:'update',entity:'Goal',entity_id:r.id,at:new Date().toISOString(),details:'saved changed'});return{ok:true,id:r.id,updated:true}}
  return{ok:true,id:r.id,duplicate:true}}
 const now=new Date().toISOString();
 if(kind==='account'){
  const name=ftext_(r.name,90);fcheck_(name.length>=2,'Account name required');
  fcheck_(['debit','cash','savings','credit','loan'].includes(r.type),'Invalid account type');
  const opening=fint_(r.opening,-1e12,1e12);
  fappend_('Accounts',{id:r.id,owner_id:m.id,name,type:r.type,currency:'RUB',opening_balance:opening,shared:!!r.shared&&m.role==='admin',status:'active',created_at:now});
 }
 if(kind==='loan'){
  const account=frows_('Accounts').find(a=>String(a.id)===String(r.accountId)&&a.status==='active');fcheck_(fcan_(m,account),'Credit account not accessible');
  fcheck_(['loan','card'].includes(r.kind),'Invalid credit kind');
  fappend_('Credits',{id:r.id,owner_id:m.id,account_id:r.accountId,name:ftext_(r.name,90),rate:Number(r.annualRate)||0,payment:fint_(r.payment,1,1e12),due_day:fint_(r.dueDay,1,31),kind:r.kind,created_at:now,principal:fint_(r.principal,1,1e12),remaining:fint_(r.remaining,0,1e12),credit_limit:r.creditLimit||''});
 }
 if(kind==='debt'){
  fcheck_(['owed','receivable'].includes(r.direction),'Invalid debt direction');
  fappend_('Debts',{id:r.id,owner_id:m.id,name:ftext_(r.name,90),direction:r.direction,amount:fint_(r.amount,1,1e12),remaining:fint_(r.remaining,0,1e12),due_date:r.dueDate?fdate_(r.dueDate):''});
 }
 if(kind==='recurring'){const account=frows_('Accounts').find(a=>String(a.id)===String(r.accountId)&&a.status==='active');fcheck_(fcan_(m,account),'Account not accessible');fcheck_(['income','expense'].includes(r.type),'Invalid recurring type');fcheck_(['once','weekly','monthly'].includes(r.frequency),'Invalid recurrence');fappend_('Recurring',{id:r.id,owner_id:m.id,type:r.type,category:ftext_(r.category,90),amount:fint_(r.amount,1,1e12),next_date:fdate_(r.nextDate),frequency:r.frequency,enabled:!!r.enabled,name:ftext_(r.name,90),account_id:r.accountId,day_of_month:fint_(r.dayOfMonth||Number(String(r.nextDate).slice(8)),1,31)});}
 if(kind==='goal')fappend_('Goals',{id:r.id,owner_id:m.id,name:ftext_(r.name,90),target:fint_(r.target,1,1e12),saved:fint_(r.saved,0,1e12),deadline:r.deadline?fdate_(r.deadline):''});
 fappend_('AuditLog',{id:Utilities.getUuid(),actor_id:m.id,action:'create',entity:kind,entity_id:r.id,at:now,details:''});
 return{ok:true,id:r.id};
})}
function fsyncRecordV2_(m,d){if(d.entity==='transaction')return fpostTransaction_(m,d.record);return fupsertV2_(m,d)}
