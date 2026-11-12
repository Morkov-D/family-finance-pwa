/** Server-side daily email reminders, including days deliberately marked as "no operations". */
function installReminderTrigger_(){const name='runDailyReminders_';ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()===name).forEach(ScriptApp.deleteTrigger);ScriptApp.newTrigger(name).timeBased().everyHours(1).create();console.log('Reminder trigger installed')}
function runDailyReminders_(){return fmutex_(()=>{
 const p=PropertiesService.getScriptProperties(),fallback=p.getProperty('FAMILY_TIMEZONE')||Session.getScriptTimeZone(),now=new Date();
 const members=frows_('FamilyMembers'),transactions=frows_('Transactions'),confirmed=frows_('DayConfirmations'),logs=frows_('ReminderLog');let total=0;
 members.forEach(m=>{
  if(String(m.status)!=='active'||String(m.remind_enabled)!=='true'||!m.email)return;
  const tz=String(m.timezone||fallback);let day,hour;
  try{day=Utilities.formatDate(now,tz,'yyyy-MM-dd');hour=Number(Utilities.formatDate(now,tz,'H'))}catch{return}
  if(hour<Number(m.remind_hour))return;
  if(transactions.some(t=>String(t.actor_id)===String(m.id)&&fdatestr_(t.date)===day))return;
  if(confirmed.some(x=>String(x.member_id)===String(m.id)&&fdatestr_(x.day)===day))return;
  if(logs.some(x=>String(x.member_id)===String(m.id)&&fdatestr_(x.day)===day))return;
  const logId=Utilities.getUuid();fappend_('ReminderLog',{id:logId,member_id:m.id,day,sent_at:new Date().toISOString(),status:'pending'});
  try{MailApp.sendEmail({to:String(m.email),subject:'Мои Финансы — проверьте записи за сегодня',body:'Здравствуйте, '+String(m.name)+'!\n\nСегодня от вашего профиля пока нет записанных операций. Проверьте расходы и доходы или нажмите «Нет операций сегодня» в приложении.\n\nВы можете отключить напоминания в настройках.'});fmodify_('ReminderLog',logId,{status:'sent'});total++}
  catch(e){fmodify_('ReminderLog',logId,{status:'error'});console.error('Email reminder failed for '+m.id)}
 });return{sent:total};
})}
