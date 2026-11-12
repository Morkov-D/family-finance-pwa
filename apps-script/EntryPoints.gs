/**
 * Открытые команды настройки Google Apps Script.
 * Функции с суффиксом "_" (включая ftext_) — внутренние.
 */
function setupBackend() {
  return setupBackend_();
}

function bootstrapOwner() {
  return bootstrapOwner_();
}

function installReminderTrigger() {
  return installReminderTrigger_();
}

function checkBackend() {
  if (typeof setupBackend_ !== 'function' || typeof frows_ !== 'function')
    throw new Error('Отсутствует Code.gs. Проверьте clasp push.');
  if (typeof installReminderTrigger_ !== 'function')
    throw new Error('Отсутствует Reminders.gs. Проверьте clasp push.');
  if (Object.prototype.hasOwnProperty.call(FIN_TABLES_, 'DayConfirmations') &&
      (typeof ftext_ !== 'function' || typeof fsyncRecordV2_ !== 'function'))
    throw new Error('Отсутствует Sync.gs или функция ftext_. Сделайте clasp push всех серверных файлов.');
  const id = PropertiesService.getScriptProperties().getProperty('FINANCE_SHEET_ID');
  if (!id) throw new Error('Сначала запустите setupBackend.');
  const ss = SpreadsheetApp.openById(id);
  const absent = Object.keys(FIN_TABLES_).filter(name => !ss.getSheetByName(name));
  if (absent.length) throw new Error('Отсутствуют вкладки: ' + absent.join(', ') + '. Повторите setupBackend.');
  const result = {ok:true,databaseUrl:ss.getUrl(),sheets:Object.keys(FIN_TABLES_).length,
    administratorCreated:frows_('FamilyMembers').length>0,
    remindersEnabled:ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='runDailyReminders_')};
  console.log(JSON.stringify(result));return result;
}