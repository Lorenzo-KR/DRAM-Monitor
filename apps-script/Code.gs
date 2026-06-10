// ================================================================
// Apps Script v11
// v10 → v11: 다중 토큰 지원 (기기/탭별 독립)
//             AUTH_TOKEN(단일) → AUTH_TOKENS(JSON 배열)
//             만료 토큰 자동 청소 + sliding expiration (남은 시간 50%↓ 시 갱신)
//             LockService 로 동시성 보호
// ================================================================

var PASSWORD        = '1234!!';
var TOKEN_EXPIRE_MS = 8 * 60 * 60 * 1000;
var MAX_TOKENS      = 50;
var MAX_FAIL        = 5;
var LOCKOUT_MS      = 3 * 60 * 1000;

var HEADERS = {
  lots:      ['id','biz','country','customerName','lotNo','inDate','targetDate','qty','unit','price','currency','product','note','done','actualDone'],
  daily:     ['id','date','lotId','lotNo','biz','country','customerName','proc','normal','noBoot','abnormal','cumul','remain','note','done','moId','moNo'],
  mos:       ['id','lotId','lotNo','moNo','qty','note'],
  invoices:  ['id','no','date','due','lotId','lotNo','biz','country','customerName','amount','vat','total','currency','status','paidDate','paidAmt','note'],
  customers: ['id','name','country','biz','contact','currency','note'],
  targets:   ['id','year','biz','target'],
  shipments: ['id','biz','country','customerName','lotNo','qty','unit','expectedDate','status','note'],
  logs:      ['id','ts','category','action','lotNo','summary'],
  settings:  ['key','value'],
};

var DATE_COLS = {
  lots:      ['inDate','targetDate','actualDone'],
  daily:     ['date'],
  mos:       [],
  invoices:  ['date','due','paidDate'],
  customers: [],
  targets:   [],
  shipments: ['expectedDate'],
  logs:      [],
  settings:  [],
};

function formatDateCell(value) {
  if (value === '' || value === null || value === undefined) return '';
  if (value instanceof Date) {
    var y = value.getFullYear();
    var m = value.getMonth() + 1;
    var d = value.getDate();
    var mm = m < 10 ? '0' + m : '' + m;
    var dd = d < 10 ? '0' + d : '' + d;
    return y + '-' + mm + '-' + dd;
  }
  var s = String(value).trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  var num = Number(s);
  if (!isNaN(num) && num > 1000) {
    var msPerDay = 86400000;
    var baseDate = new Date(Date.UTC(1899, 11, 30));
    var dt = new Date(baseDate.getTime() + num * msPerDay);
    var dy = dt.getUTCFullYear();
    var dm = dt.getUTCMonth() + 1;
    var dd2 = dt.getUTCDate();
    var dmm = dm < 10 ? '0' + dm : '' + dm;
    var ddd = dd2 < 10 ? '0' + dd2 : '' + dd2;
    return dy + '-' + dmm + '-' + ddd;
  }
  return s;
}

function isLockedOut() {
  var props = PropertiesService.getScriptProperties();
  var lockUntil = parseInt(props.getProperty('AUTH_LOCK_UNTIL') || '0');
  return new Date().getTime() < lockUntil;
}

function recordFail() {
  var props = PropertiesService.getScriptProperties();
  var cnt = parseInt(props.getProperty('AUTH_FAIL_COUNT') || '0') + 1;
  props.setProperty('AUTH_FAIL_COUNT', String(cnt));
  if (cnt >= MAX_FAIL) {
    props.setProperty('AUTH_LOCK_UNTIL', String(new Date().getTime() + LOCKOUT_MS));
    props.setProperty('AUTH_FAIL_COUNT', '0');
  }
}

function clearFail() {
  var props = PropertiesService.getScriptProperties();
  props.setProperty('AUTH_FAIL_COUNT', '0');
  props.setProperty('AUTH_LOCK_UNTIL', '0');
}

function generateToken() {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var token = '';
  for (var i = 0; i < 48; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// ── 다중 토큰 저장/검증 ─────────────────────────────────────────
// AUTH_TOKENS: [{ t: <token>, e: <expiresMs> }, ...]

function loadTokens_() {
  var raw = PropertiesService.getScriptProperties().getProperty('AUTH_TOKENS');
  if (!raw) return [];
  try { var arr = JSON.parse(raw); return Array.isArray(arr) ? arr : []; }
  catch(e) { return []; }
}

function saveTokens_(tokens) {
  PropertiesService.getScriptProperties().setProperty('AUTH_TOKENS', JSON.stringify(tokens));
}

function pruneExpired_(tokens) {
  var now = new Date().getTime();
  return tokens.filter(function(t) { return t && t.e > now; });
}

function saveToken(token) {
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var tokens = pruneExpired_(loadTokens_());
    tokens.push({ t: token, e: new Date().getTime() + TOKEN_EXPIRE_MS });
    // 토큰 폭증 방지 — 가장 오래된 것부터 제거
    if (tokens.length > MAX_TOKENS) tokens = tokens.slice(tokens.length - MAX_TOKENS);
    saveTokens_(tokens);
  } finally {
    lock.releaseLock();
  }
}

function isValidToken(token) {
  if (!token) return false;
  var tokens = loadTokens_();
  var now = new Date().getTime();
  var foundIdx = -1;
  for (var i = 0; i < tokens.length; i++) {
    if (tokens[i] && tokens[i].t === token && tokens[i].e > now) {
      foundIdx = i;
      break;
    }
  }
  if (foundIdx < 0) return false;

  // Sliding expiration — 남은 시간이 절반 이하면 만료 시각 갱신
  var remaining = tokens[foundIdx].e - now;
  if (remaining < TOKEN_EXPIRE_MS / 2) {
    var lock = LockService.getScriptLock();
    if (lock.tryLock(1000)) {
      try {
        var fresh = pruneExpired_(loadTokens_());
        for (var j = 0; j < fresh.length; j++) {
          if (fresh[j].t === token) {
            fresh[j].e = now + TOKEN_EXPIRE_MS;
            break;
          }
        }
        saveTokens_(fresh);
      } finally {
        lock.releaseLock();
      }
    }
  }
  return true;
}

function doGet(e) {
  var result;
  try {
    var action = e.parameter.action;
    var token  = e.parameter.token;

    if (action === 'auth') {
      if (isLockedOut()) {
        return respond({ error: 'LOCKED', message: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.' });
      }
      var pw = e.parameter.pw;
      if (pw === PASSWORD) {
        clearFail();
        var newToken = generateToken();
        saveToken(newToken);
        return respond({ token: newToken });
      } else {
        recordFail();
        return respond({ error: 'WRONG_PASSWORD' });
      }
    }

    // getDramPrices — 토큰 불필요 (공개 데이터), sheet 파라미터로 시트 선택
    if (action === 'getDramPrices') {
      var sheetName = e.parameter.sheet || 'spot_prices';
      return respond(getDramPricesBySheet(sheetName));
    }

    if (!isValidToken(token)) {
      return respond({ error: 'UNAUTHORIZED' });
    }

    if (action === 'getAll') {
      ensureHeaders(e.parameter.sheet);
      result = getAll(e.parameter.sheet);
    } else if (action === 'getAllData') {
      Object.keys(HEADERS).forEach(function(s) { ensureHeaders(s); });
      result = {
        lots:      getAll('lots'),
        daily:     getAll('daily'),
        mos:       getAll('mos'),
        invoices:  getAll('invoices'),
        customers: getAll('customers'),
        targets:   getAll('targets'),
        shipments: getAll('shipments'),
        settings:  getAll('settings'),
      };
    } else if (action === 'getLogs') {
      ensureHeaders('logs');
      result = getAll('logs');
    } else if (action === 'getSetting') {
      result = getSetting(e.parameter.key);
    } else if (action === 'setupAll') {
      Object.keys(HEADERS).forEach(function(s) { ensureHeaders(s); });
      result = { success: true };
    } else {
      result = { error: 'Unknown action' };
    }
  } catch(err) {
    result = { error: err.message };
  }
  return respond(result);
}

function doPost(e) {
  var body = {}, result;
  try {
    body = JSON.parse(e.postData.contents);
    if (body.action === 'auth') {
      if (isLockedOut()) return respond({ error: 'LOCKED', message: '로그인 시도가 너무 많습니다.' });
      if (body.pw === PASSWORD) {
        clearFail();
        var newToken = generateToken();
        saveToken(newToken);
        return respond({ token: newToken });
      } else {
        recordFail();
        return respond({ error: 'WRONG_PASSWORD' });
      }
    }
    if (!isValidToken(body.token)) return respond({ error: 'UNAUTHORIZED' });
    if (body.action === 'append')          result = appendRow(body.sheet, body.data);
    else if (body.action === 'delete')     result = deleteRow(body.sheet, body.id);
    else if (body.action === 'update')     result = updateRow(body.sheet, body.id, body.data);
    else if (body.action === 'setSetting') result = setSetting(body.key, body.value);
    else result = { error: 'Unknown action: ' + body.action };
  } catch(err) {
    result = { error: err.message };
  }
  return respond(result);
}

function respond(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function getSheetIfExists(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function ensureHeaders(sheetName) {
  var defined = HEADERS[sheetName];
  if (!defined) return;
  var sheet = getSheet(sheetName);
  var current = [];
  if (sheet.getLastColumn() > 0) {
    current = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  }
  if (JSON.stringify(current.slice(0, defined.length)) === JSON.stringify(defined)) return;
  sheet.getRange(1, 1, 1, defined.length).setValues([defined]);
}

function getHeaders(sheet) {
  if (sheet.getLastColumn() === 0) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
}

function getAll(sheetName) {
  var sheet = getSheetIfExists(sheetName);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  var headers = getHeaders(sheet);
  if (!headers.length) return [];
  var dateCols = DATE_COLS[sheetName] || [];
  var data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return data.map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) {
      if (!h) return;
      obj[h] = dateCols.indexOf(h) >= 0 ? formatDateCell(row[i]) : row[i];
    });
    return obj;
  }).filter(function(obj) {
    if (sheetName === 'settings') return obj.key !== '' && obj.key !== undefined;
    return obj.id !== '' && obj.id !== undefined && obj.id !== null;
  });
}

function appendRow(sheetName, data) {
  ensureHeaders(sheetName);
  var sheet = getSheet(sheetName);
  var headers = getHeaders(sheet);
  var row = headers.map(function(h) { return data[h] !== undefined ? data[h] : ''; });
  sheet.appendRow(row);
  return { success: true };
}

function deleteRow(sheetName, id) {
  var sheet = getSheet(sheetName);
  var headers = getHeaders(sheet);
  var idCol = headers.indexOf('id');
  if (idCol === -1) return { error: 'id column not found' };
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { error: 'Row not found' };
  var ids = sheet.getRange(2, idCol + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) { sheet.deleteRow(i + 2); return { success: true }; }
  }
  return { error: 'Row not found' };
}

function updateRow(sheetName, id, newData) {
  var sheet = getSheet(sheetName);
  var headers = getHeaders(sheet);
  var idCol = headers.indexOf('id');
  if (idCol === -1) return { error: 'id column not found' };
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { error: 'Row not found' };
  var ids = sheet.getRange(2, idCol + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) {
      var rowNum = i + 2;
      var current = sheet.getRange(rowNum, 1, 1, headers.length).getValues()[0];
      var newRow = headers.map(function(h, j) { return newData[h] !== undefined ? newData[h] : current[j]; });
      sheet.getRange(rowNum, 1, 1, headers.length).setValues([newRow]);
      return { success: true };
    }
  }
  return { error: 'Row not found' };
}

function getSetting(key) {
  ensureHeaders('settings');
  var sheet = getSheet('settings');
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { key: key, value: null };
  var rows = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === String(key)) return { key: key, value: rows[i][1] };
  }
  return { key: key, value: null };
}

function setSetting(key, value) {
  ensureHeaders('settings');
  var sheet = getSheet('settings');
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    var keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < keys.length; i++) {
      if (String(keys[i][0]) === String(key)) {
        sheet.getRange(i + 2, 2).setValue(value);
        return { success: true };
      }
    }
  }
  sheet.appendRow([key, value]);
  return { success: true };
}

// ── DRAM Price Tracking ──────────────────────────────────────────
function getDramPricesBySheet(sheetName) {
  try {
    var ss = SpreadsheetApp.openById('1B46Hj-5u0ikoGBm56PBvq8BIJhi5zDgsSlPE-tDM0BA');
    var ws = ss.getSheetByName(sheetName);
    if (!ws) return { error: sheetName + ' 시트 없음' };
    var lastRow = ws.getLastRow();
    if (lastRow <= 1) return [];
    var headers = ws.getRange(1, 1, 1, ws.getLastColumn()).getValues()[0].map(String);
    var data    = ws.getRange(2, 1, lastRow - 1, headers.length).getValues();
    return data.map(function(row) {
      var obj = {};
      headers.forEach(function(h, i) {
        var v = row[i];
        obj[h] = (h === 'Date') ? formatDateCell(v) : (v === null || v === undefined ? '' : String(v));
      });
      return obj;
    }).filter(function(r) { return r['Date'] && r['Item']; });
  } catch(err) {
    return { error: err.message };
  }
}
