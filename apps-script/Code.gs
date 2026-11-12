/** Family Finance server v1. Requires manual setup from bound Apps Script editor.
 * No financial data is returned by direct doPost/ContentService.
 * Use the iframe Bridge.html + google.script.run with server-side PIN sessions.
 * setupBackend_ and bootstrapOwner_ are PRIVATE (underscore) functions.
 */
const FIN_TABLES_={
 FamilyMembers:['id','name','role','status','pin_salt','pin_hash','email','remind_enabled','remind_hour','created_at','timezone'],
 Accounts:['id','owner_id','name','type','currency','opening_balance','shared','status','created_at'],
 AccountAccess:['id','account_id','member_id','can_read','can_write'],
 Categories:['id','name','kind','parent_id','active'],
 Transactions:['id','type','date','category','amount','currency','account_id','target_account_id','comment','actor_id','owner_id','created_at','status'],
 TransactionLines:['id','transaction_id','account_id','amount','created_at'],
 Credits:['id','owner_id','account_id','name','rate','payment','due_day','kind','created_at','principal','remaining','credit_limit'],
 Debts:['id','owner_id','name','direction','amount','remaining','due_date'],
 Budgets:['id','month','category','limit_amount','owner_id'],
 Goals:['id','owner_id','name','target','saved','deadline'],
 Recurring:['id','owner_id','type','category','amount','next_date','frequency','enabled','name','account_id','day_of_month'],
 Sessions:['id','member_id','token_hash','expires_at','created_at','revoked'],
 LoginAttempts:['id','member_id','at','success'],
 SyncLog:['id','operation_id','actor_id','result','at'],
 DayConfirmations:['id','member_id','day','confirmed_at'],
 ReminderLog:['id','member_id','day','sent_at','status'],
 AuditLog:['id','actor_id','action','entity','entity_id','at','details'],
 Settings:['key','value']
};
function fss_(){const props=PropertiesService.getScriptProperties();const id=props.getProperty('FINANCE_SHEET_ID');if(!id)throw Error('Backend not initialized');return SpreadsheetApp.openById(id)}
function fsheet_(name){const sh=fss_().getSheetByName(name);if(!sh)throw Error('Missing sheet '+name);return sh}
function frows_(name){const sh=fsheet_(name),values=sh.getDataRange().getValues();if(values.length<2)return [];const columns=values[0].map(String);return values.slice(1).filter(r=>r[0]!==''&&r[0]!==null).map(r=>Object.fromEntries(columns.map((h,i)=>[h,r[i]])))}
function fappend_(name,data){const sh=fsheet_(name);const head=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);sh.appendRow(head.map(x=>{const v=data[x]===undefined?'':data[x];return typeof v==='string'&&/^[=+@\t\r]/.test(v)?"'"+v:v}))}
function fmodify_(name,id,changes){const sh=fsheet_(name),v=sh.getDataRange().getValues(),heads=v[0].map(String);const row=v.findIndex((r,i)=>i>0&&String(r[0])===String(id));if(row<0)throw Error('Row not found');Object.keys(changes).forEach(k=>{const col=heads.indexOf(k);if(col>=0)sh.getRange(row+1,col+1).setValue(typeof changes[k]==='string'&&/^[=+@\t\r]/.test(changes[k])?"'"+changes[k]:changes[k])})}
function fhex_(bytes){return bytes.map(b=>('0'+(b&255).toString(16)).slice(-2)).join('')}
function fhash_(raw,salt){const pepper=PropertiesService.getScriptProperties().getProperty('FINANCE_PEPPER');if(!pepper)throw Error('No server pepper');return fhex_(Utilities.computeHmacSha256Signature(String(raw),String(salt)+pepper))}
function fmutex_(fn){const lock=LockService.getScriptLock();if(!lock.tryLock(20000))throw Error('Server busy');try{return fn()}finally{lock.releaseLock()}}
function fcheck_(condition,msg){if(!condition)throw Error(msg)}
function fcurrent_(memberId){return frows_('FamilyMembers').find(m=>String(m.id)===String(memberId)&&m.status==='active')}
function fsession_(token){fcheck_(typeof token==='string'&&token.length>=60,'Unauthorized');const now=Date.now(),hash=fhash_(token,'session');const s=frows_('Sessions').find(x=>String(x.token_hash)===hash&&!x.revoked&&new Date(x.expires_at).getTime()>now);fcheck_(!!s,'Session expired');const m=fcurrent_(s.member_id);fcheck_(!!m,'Member disabled');return m}
function fcan_(m,account){return account&&(String(account.owner_id)===String(m.id)||String(account.shared)==='true'||account.shared===true)}
function fvalidateId_(id){fcheck_(typeof id==='string'&&/^[a-f0-9-]{36}$/i.test(id),'Invalid ID')}
function fmoney_(v){fcheck_(typeof v==='number'&&Number.isSafeInteger(v)&&v>0&&v<1e12,'Invalid amount in kopecks');return v}
/** Run ONCE from Apps Script editor. If FINANCE_SHEET_ID absent, creates a new spreadsheet. */
function setupBackend_(){const p=PropertiesService.getScriptProperties();let sid=p.getProperty('FINANCE_SHEET_ID');if(!sid){sid=SpreadsheetApp.create('Мои Финансы — База семьи').getId();p.setProperty('FINANCE_SHEET_ID',sid)}if(!p.getProperty('FINANCE_PEPPER'))p.setProperty('FINANCE_PEPPER',Utilities.getUuid()+Utilities.getUuid()+Utilities.getUuid());const ss=SpreadsheetApp.openById(sid);Object.keys(FIN_TABLES_).forEach(name=>{let sh=ss.getSheetByName(name);if(!sh)sh=ss.insertSheet(name);if(sh.getLastRow()===0){const heads=FIN_TABLES_[name];sh.getRange(1,1,1,heads.length).setValues([heads]).setFontWeight('bold');sh.setFrozenRows(1)}else{const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String),missing=FIN_TABLES_[name].filter(h=>!headers.includes(h));if(missing.length)sh.getRange(1,headers.length+1,1,missing.length).setValues([missing])}});const textDateColumns={Transactions:['date'],Debts:['due_date'],Budgets:['month'],ReminderLog:['day'],DayConfirmations:['day'],Recurring:['next_date']};Object.keys(textDateColumns).forEach(name=>{const sh=ss.getSheetByName(name),heads=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);textDateColumns[name].forEach(c=>{const col=heads.indexOf(c)+1;if(col>0)sh.getRange(2,col,sh.getMaxRows()-1,1).setNumberFormat('@')})});console.log('Database spreadsheet: https://docs.google.com/spreadsheets/d/'+sid+'/edit');return sid}
/** Initial admin: set INITIAL_ADMIN_NAME, INITIAL_ADMIN_PIN (6 digits), INITIAL_ADMIN_EMAIL in Script Properties, run this function in editor. PIN deleted after use. */
function bootstrapOwner_(){return fmutex_(()=>{const p=PropertiesService.getScriptProperties(),name=p.getProperty('INITIAL_ADMIN_NAME'),pin=p.getProperty('INITIAL_ADMIN_PIN'),email=p.getProperty('INITIAL_ADMIN_EMAIL')||'';fcheck_(frows_('FamilyMembers').length===0,'Owner already exists');fcheck_(name&&/^\d{6}$/.test(pin||''),'Set valid initial name/PIN in Script Properties');const userId=Utilities.getUuid(),salt=Utilities.getUuid();fappend_('FamilyMembers',{id:userId,name:String(name).slice(0,100),role:'admin',status:'active',pin_salt:salt,pin_hash:fhash_(pin,salt),email,remind_enabled:false,remind_hour:20,created_at:new Date().toISOString(),timezone:p.getProperty('FAMILY_TIMEZONE')||Session.getScriptTimeZone()});p.deleteProperty('INITIAL_ADMIN_PIN');p.deleteProperty('INITIAL_ADMIN_NAME');p.deleteProperty('INITIAL_ADMIN_EMAIL');console.log('Owner ID: '+userId);return userId})}
function doGet(){return HtmlService.createHtmlOutput('<!doctype html><html lang="ru"><meta charset="utf-8"><title>Мои Финансы — API</title><body style="font:16px system-ui;padding:40px;max-width:580px;margin:auto"><h1>Мои Финансы</h1><p>Серверная часть установлена. Откройте семейное PWA на GitHub Pages и укажите ссылку на этот Apps Script в настройках.</p><p>Для проверки API используется защищённое соединение через HTTPS-шлюз. Данные без авторизации по PIN не выдаются.</p></body></html>').setTitle('Family Finance API')}
/** Direct POST is accepted from server-side transport; every financial action requires a PIN/session. */
function doPost(e){
 let result;
 try{const input=JSON.parse(String(e&&e.postData&&e.postData.contents||'{}'));result=rpc(input)}
 catch(err){result={ok:false,error:String(err&&err.message||err)}}
 return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}
/** Public RPC entrypoint. All financial actions require session. */
function rpc(request){try{return frpc_(request)}catch(error){return{ok:false,error:String(error&&error.message||error)}}}
function frpc_(req){fcheck_(req&&typeof req==='object'&&typeof req.action==='string','Invalid request');const action=req.action,data=req.data||{};if(action==='ping')return{ok:true,version:'2.0',serverTime:new Date().toISOString()};if(action==='profiles')return{ok:true,items:frows_('FamilyMembers').filter(m=>m.status==='active').map(m=>({id:m.id,name:m.name,role:m.role}))};if(action==='login')return flogin_(data);
 const member=fsession_(req.token);if(action==='me')return{ok:true,user:{id:member.id,name:member.name,role:member.role,email:member.email}};
 if(action==='snapshot')return fsnapshotV2_(member,data);
 if(action==='syncRecord')return fsyncRecordV2_(member,data);
 if(action==='createMember')return fcreateMemberV2_(member,data);
 if(action==='postTransaction')return fpostTransaction_(member,data);
 if(action==='createAccount')return fcreateAccount_(member,data);
 if(action==='setReminder')return fsetReminder_(member,data);
 throw Error('Unknown action')}
function flogin_(data){return fmutex_(()=>{const id=String(data.memberId||''),pin=String(data.pin||'');fcheck_(/^\d{6}$/.test(pin),'PIN should have six digits');const member=fcurrent_(id);const last=frows_('LoginAttempts').filter(x=>String(x.member_id)===id&&new Date(x.at).getTime()>Date.now()-15*60000);fcheck_(last.filter(x=>String(x.success)!=='true').length<5,'Too many attempts; try in 15 minutes');const good=!!member&&fhash_(pin,member.pin_salt)===String(member.pin_hash);fappend_('LoginAttempts',{id:Utilities.getUuid(),member_id:id,at:new Date().toISOString(),success:good});fcheck_(good,'Invalid PIN');const token=[Utilities.getUuid(),Utilities.getUuid(),Utilities.getUuid()].join('');const expiresAt=new Date(Date.now()+30*86400000).toISOString();fappend_('Sessions',{id:Utilities.getUuid(),member_id:id,token_hash:fhash_(token,'session'),expires_at:expiresAt,created_at:new Date().toISOString(),revoked:false});return{ok:true,token,expiresAt,user:{id:member.id,name:member.name,role:member.role}}})}
function fsnapshot_(m,data){const accounts=frows_('Accounts').filter(a=>a.status==='active'&&fcan_(m,a));const allowed=new Set(accounts.map(a=>String(a.id)));const tx=frows_('Transactions').filter(t=>allowed.has(String(t.account_id))||allowed.has(String(t.target_account_id)));return{ok:true,accounts:accounts.slice(-500),transactions:tx.slice(-3000),members:frows_('FamilyMembers').filter(x=>x.status==='active').map(x=>({id:x.id,name:x.name})),budgets:frows_('Budgets').slice(-300),credits:frows_('Credits').filter(x=>x.owner_id===m.id),debts:frows_('Debts').filter(x=>x.owner_id===m.id),goals:frows_('Goals').filter(x=>x.owner_id===m.id)}}
function fcreateAccount_(m,data){return fmutex_(()=>{fvalidateId_(data.id);fcheck_(data.name&&String(data.name).trim().length<100,'Invalid account name');fcheck_(['debit','cash','savings','credit','loan'].includes(data.type),'Invalid account type');fcheck_(Number.isSafeInteger(data.opening),'Invalid opening balance');fcheck_(!frows_('Accounts').some(a=>String(a.id)===data.id),'Account ID already exists');fappend_('Accounts',{id:data.id,owner_id:m.id,name:String(data.name).trim(),type:data.type,currency:'RUB',opening_balance:data.opening,shared:m.role==='admin'&&!!data.shared,status:'active',created_at:new Date().toISOString()});return{ok:true,id:data.id}})}
function fpostTransaction_(m,data){return fmutex_(()=>{
 fcheck_(data&&typeof data==='object','Missing transaction');fvalidateId_(data.id);
 fcheck_(['income','expense','transfer'].includes(data.type),'Invalid operation type');
 const amount=fmoney_(data.amount),date=fdate_(data.date),accounts=frows_('Accounts');
 const from=accounts.find(a=>String(a.id)===String(data.accountId)&&a.status==='active');
 fcheck_(fcan_(m,from),'Source account is not accessible');
 let to=null;
 if(data.type==='transfer'){
   to=accounts.find(a=>String(a.id)===String(data.targetAccountId)&&a.status==='active');
   fcheck_(fcan_(m,to)&&String(to.id)!==String(from.id),'Destination account is not accessible');
 }else fcheck_(String(data.category||'').trim().length>0&&String(data.category).length<=100,'Category required');
 const txs=frows_('Transactions'),old=txs.find(t=>String(t.id)===String(data.id));
 const logs=frows_('SyncLog'),log=logs.find(x=>String(x.operation_id)===String(data.id));
 if(old){
   fcheck_(String(old.actor_id)===String(m.id)&&String(old.account_id)===String(from.id)&&String(old.target_account_id||'')===String(to?to.id:'')&&Number(old.amount)===amount&&String(old.type)===String(data.type)&&fdatestr_(old.date)===date,'UUID collision / transaction mismatch');
 }else{
   if(!log)fappend_('SyncLog',{id:Utilities.getUuid(),operation_id:data.id,actor_id:m.id,result:'pending',at:new Date().toISOString()});
   fappend_('Transactions',{id:data.id,type:data.type,date:date,category:data.type==='transfer'?'Перевод':ftext_(data.category,100),amount,currency:'RUB',account_id:from.id,target_account_id:to?to.id:'',comment:ftext_(data.note||'',300),actor_id:m.id,owner_id:m.id,created_at:new Date().toISOString(),status:'posted'});
 }
 const existingLines=frows_('TransactionLines').filter(line=>String(line.transaction_id)===String(data.id));
 const expected=[{account_id:from.id,amount:data.type==='income'?amount:-amount}];
 if(to)expected.push({account_id:to.id,amount:amount});
 expected.forEach(line=>{if(!existingLines.some(x=>String(x.account_id)===String(line.account_id)&&Number(x.amount)===line.amount))fappend_('TransactionLines',{id:Utilities.getUuid(),transaction_id:data.id,account_id:line.account_id,amount:line.amount,created_at:new Date().toISOString()})});
 const actualLog=log||frows_('SyncLog').find(x=>String(x.operation_id)===String(data.id));
 if(actualLog&&String(actualLog.result)!=='committed')fmodify_('SyncLog',actualLog.id,{result:'committed'});
 if(!old)fappend_('AuditLog',{id:Utilities.getUuid(),actor_id:m.id,action:'post',entity:'Transaction',entity_id:data.id,at:new Date().toISOString(),details:data.type});
 return{ok:true,id:data.id,duplicate:!!old};
})}
function fsetReminder_(m,data){return fmutex_(()=>{const hour=Number(data.hour),enabled=data.enabled===true;fcheck_(Number.isInteger(hour)&&hour>=8&&hour<=23,'Invalid hour');const email=String(data.email||m.email||'').trim();fcheck_(!enabled||/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email),'Email required');fmodify_('FamilyMembers',m.id,{remind_enabled:enabled,remind_hour:hour,email});return{ok:true}})}
