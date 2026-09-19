const TAB_NAMES = ['Snapshot', 'Meals', 'Workouts', 'Body', 'Steps'];

function doGet() {
  return json_({ ok: true, data: { service: 'FIT LOG API', status: 'ready' } });
}

function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents || '{}');
    verifyToken_(request.token);
    const action = request.action;
    const payload = request.payload || {};
    enforceRateLimit_(action);
    if (action === 'backup') return json_({ ok: true, data: saveBackup_(payload.db) });
    if (action === 'restore') return json_({ ok: true, data: loadBackup_() });
    if (action === 'analyzeFood') return json_({ ok: true, data: analyzeFood_(payload) });
    throw new Error('Unknown action: ' + action);
  } catch (error) {
    return json_({ ok: false, error: String(error.message || error) });
  }
}

function setupFitLog() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  TAB_NAMES.forEach(name => {
    if (!spreadsheet.getSheetByName(name)) spreadsheet.insertSheet(name);
  });
  const token = Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('APP_TOKEN', token);
  const message = 'Setup completed. APP_TOKEN: ' + token;
  console.log(message);
  return message;
}

function saveBackup_(db) {
  if (!db || typeof db !== 'object') throw new Error('Missing database payload');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  writeSnapshot_(ss.getSheetByName('Snapshot'), JSON.stringify(db));
  writeTable_(ss.getSheetByName('Meals'), ['id','date','time','type','calories','protein','carbs','fat','items_json'], (db.meals || []).map(x => [x.id,x.date,x.time,x.type,x.calories,x.protein,x.carbs,x.fat,JSON.stringify(x.items || [])]));
  writeTable_(ss.getSheetByName('Workouts'), ['id','date','time','groups','volume','exercises_json'], (db.workouts || []).map(x => [x.id,x.date,x.time,(x.groups || []).join(', '),x.volume,JSON.stringify(x.exercises || [])]));
  writeTable_(ss.getSheetByName('Body'), ['date','time','weight','body_fat','muscle'], (db.body || []).map(x => [x.date,x.time,x.weight,x.bodyFat,x.muscle]));
  writeTable_(ss.getSheetByName('Steps'), ['date','steps'], (db.steps || []).map(x => [x.date,x.value]));
  return { savedAt: new Date().toISOString() };
}

function loadBackup_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Snapshot');
  if (!sheet || sheet.getLastRow() < 2) return null;
  const chunks = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues().flat();
  return JSON.parse(chunks.join(''));
}

function writeSnapshot_(sheet, text) {
  const max = 45000;
  const chunks = [];
  for (let i = 0; i < text.length; i += max) chunks.push([text.slice(i, i + max)]);
  sheet.clearContents();
  sheet.getRange(1, 1).setValue('FIT LOG JSON SNAPSHOT');
  if (chunks.length) sheet.getRange(2, 1, chunks.length, 1).setValues(chunks);
}

function writeTable_(sheet, headers, rows) {
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  if (rows.length) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sheet.setFrozenRows(1);
}

function analyzeFood_(payload) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
  if (!payload.imageBase64) throw new Error('Missing image');
  const model = PropertiesService.getScriptProperties().getProperty('GEMINI_MODEL') || 'gemini-2.5-flash';
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(apiKey);
  const prompt = [
    '你是一個香港飲食營養紀錄助手。分析相片中每一項可見食物。',
    '辨認食物、推測煮法、份量、用油程度，並估算卡路里、蛋白質、碳水與脂肪。',
    '考慮港式及亞洲食物、醬汁與隱藏油脂。無法判斷時用「不確定」，不要假裝精確。',
    '數值必須是 number。mealType 只能是 早餐、午餐、晚餐、小食、運動後餐。',
    '只輸出 JSON。'
  ].join('\n');
  const schema = {
    type: 'OBJECT',
    properties: {
      mealType: { type: 'STRING' },
      confidence: { type: 'STRING' },
      notes: { type: 'STRING' },
      items: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING' }, cookingMethod: { type: 'STRING' }, portion: { type: 'STRING' }, oil: { type: 'STRING' },
            calories: { type: 'NUMBER' }, protein: { type: 'NUMBER' }, carbs: { type: 'NUMBER' }, fat: { type: 'NUMBER' }
          },
          required: ['name','cookingMethod','portion','oil','calories','protein','carbs','fat']
        }
      }
    },
    required: ['mealType','confidence','items']
  };
  const body = {
    contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: payload.mimeType || 'image/jpeg', data: payload.imageBase64 } }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.2 }
  };
  const response = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', payload: JSON.stringify(body), muteHttpExceptions: true });
  if (response.getResponseCode() >= 300) throw new Error('AI request failed: ' + response.getContentText().slice(0, 300));
  const result = JSON.parse(response.getContentText());
  const text = result.candidates && result.candidates[0] && result.candidates[0].content.parts[0].text;
  if (!text) throw new Error('AI returned no result');
  return JSON.parse(text);
}

function verifyToken_(token) {
  const expected = PropertiesService.getScriptProperties().getProperty('APP_TOKEN');
  if (!expected) throw new Error('Run setupFitLog first');
  if (!token || token !== expected) throw new Error('Unauthorized');
}

function enforceRateLimit_(action) {
  const limits = { analyzeFood: 30, backup: 500, restore: 50 };
  const limit = limits[action] || 100;
  const date = Utilities.formatDate(new Date(), 'Asia/Hong_Kong', 'yyyy-MM-dd');
  const key = 'RATE_' + date + '_' + action;
  const properties = PropertiesService.getScriptProperties();
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const used = Number(properties.getProperty(key) || 0);
    if (used >= limit) throw new Error('Daily ' + action + ' limit reached');
    properties.setProperty(key, String(used + 1));
  } finally {
    lock.releaseLock();
  }
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
