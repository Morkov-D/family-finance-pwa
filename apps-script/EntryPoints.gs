/**
 * Публичные команды настройки семейной базы.
 * Эти функции видны в меню "Выполнить" Google Apps Script.
 * Вспомогательные ftext_, frows_ и другие функции с '_' оставляем внутренними.
 */
function setupBackend() {
  return setupBackend_();
}

/**
 * Создаёт первого администратора ОДИН РАЗ.
 * До запуска задайте INITIAL_ADMIN_NAME и INITIAL_ADMIN_PIN
 * в Настройки проекта -> Свойства скрипта.
 */
function bootstrapOwner() {
  return bootstrapOwner_();
}

/** Создаёт часовой триггер почтовых напоминаний. */
function installReminderTrigger() {
  return installReminderTrigger_();
}

/**
 * Проверяет, что в проект попали все серверные файлы и база настроена.
 * Не выводит PIN, ключи или другие секреты.
 */
function checkBackend() {
  const required = {
    'Code.gs': typeof setupBackend_ === 'function' && typeof frows_ === 'function',
    'Sync.gs': !Object.prototype.hasOwnProperty.call(FIN_TABLES_, 'DayConfirmations') || (typeof ftext_ === 'function' && typeof fsyncRecordV2_ === 'function'),
    'Reminders.gs': typeof installReminderTrigger_ === 'function'
  };
  const missing = Object.keys(required).filter(name => !required[name]);
  if (missing.length) {
    throw new Error('Отсутствуют функции из: ' + missing.join(', ') + '. Проверьте, что clasp push загрузил ВСЕ файлы из apps-script, особенно Sync.gs с функцией ftext_.');
  }
  const id = PropertiesService.getScriptProperties().getProperty('FINANCE_SHEET_ID');
  if (!id) throw new Error('База ещё не создана. Сначала запустите setupBackend.');
  const ss = SpreadsheetApp.openById(id);
  const absent = Object.keys(FIN_TABLES_).filter(name => !ss.getSheetByName(name));
  if (absent.length) throw new Error('Нет вкладок: ' + absent.join(', ') + '. Запустите setupBackend ещё раз.');
  const result = {
    ok: true,
    databaseUrl: ss.getUrl(),
    sheets: Object.keys(FIN_TABLES_).length,
    administratorCreated: frows_('FamilyMembers').length > 0,
    remindersEnabled: ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'runDailyReminders_')
  };
  console.log(JSON.stringify(result));
  return result;
}
