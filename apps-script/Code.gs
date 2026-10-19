/**
 * Caseboard — Template สำหรับทุกวอร์ด / ทุกสาย
 * ผูกสคริปต์นี้กับ Google Sheet เปล่า (Extensions → Apps Script) แล้ว Deploy เป็น Web app
 * สคริปต์จะสร้างแท็บที่ต้องใช้ให้เองตอนเปิดเว็บครั้งแรก:
 *   Cases       — รายชื่อคนไข้ (1 แถว = 1 admission, D/C แล้วยังเก็บแถวไว้)
 *   Team        — คนรับเคส (เพิ่ม/ลด/เปลี่ยนชื่อได้จากหน้าเว็บ → ตั้งค่า)
 *   Attendings  — รายชื่ออาจารย์
 *   Wards       — วอร์ด + ที่ตั้ง
 *   Duty        — ตารางเวร (วันที่ → ชื่อ)
 *   Config      — ชื่อ Rotation/สาย, น้ำหนักคะแนน, โฟลเดอร์เก็บภาพ
 *   Notes, Templates, Imaging — บันทึก, template ของ note, ภาพ X-ray/CT/MRI/US
 *   Caseboard   — หน้าแรกของชีท: ปุ่ม 🚀 Deploy + ลิงก์เว็บแอปที่ C1:E1
 * คะแนนแจกเคสคำนวณในสคริปต์จากแท็บ Cases + น้ำหนักใน Config (ไม่มีสูตรในชีทให้พัง)
 */

var SH = { CASES: 'Cases', TEAM: 'Team', ATT: 'Attendings', WARDS: 'Wards', DUTY: 'Duty', CONFIG: 'Config',
           NOTES: 'Notes', TPL: 'Templates', IMG: 'Imaging', HOME: 'Caseboard' };
var CASE_HEADER = ['id', 'ผู้รับ', 'วันที่ admit', 'สถานะ', 'Consult', 'แผล', 'วอร์ด', 'เตียง', 'ชื่อ-สกุล', 'HN', 'อายุ',
                   'อาจารย์', 'CC', 'Dx', 'Plan', 'Note', 'D/C เมื่อ', 'บันทึกเมื่อ'];
var C = { id: 1, assignee: 2, admit: 3, status: 4, consult: 5, wound: 6, ward: 7, bed: 8, name: 9, hn: 10, age: 11,
          attending: 12, cc: 13, dx: 14, plan: 15, note: 16, dcAt: 17, createdAt: 18 };
var ACTIVE = 'Active', DC = 'D/C';
var DEFAULT_CONFIG = {
  name: 'Caseboard', subtitle: '', assign_mode: 'wheel',
  w_active: 1, w_dc: 0.1, w_consult: 0.5, w_wound: 1, w_doy: 0.7, w_sdoy: 0.5, doy_days: 3, sdoy_days: 7,
  sheet_id: '', imaging_folder_id: '', web_url: '', web_sheet_id: ''
};
var CONFIG_LABELS = {
  name: 'ชื่อ Rotation / สาย', subtitle: 'คำอธิบายใต้ชื่อ (เช่น ชื่อแผนก / ช่วงเวลา)', assign_mode: 'วิธีแจกเคส: wheel = สุ่มด้วยวงล้อ, manual = เลือกผู้รับเอง',
  w_active: 'น้ำหนัก: Active', w_dc: 'น้ำหนัก: D/C แล้ว', w_consult: 'น้ำหนัก: Consult', w_wound: 'น้ำหนัก: แผล (บวกเพิ่ม)',
  w_doy: 'น้ำหนัก: ดอย', w_sdoy: 'น้ำหนัก: ซุปเปอร์ดอย', doy_days: 'นอนเกินกี่วันนับเป็นดอย', sdoy_days: 'นอนเกินกี่วันนับเป็นซุปเปอร์ดอย',
  sheet_id: '(ระบบใช้) id ของชีทนี้', imaging_folder_id: '(ระบบใช้) โฟลเดอร์เก็บภาพ',
  web_url: '(ระบบใช้) ลิงก์เว็บแอป /exec — แก้ผ่านปุ่ม 🚀 ในแท็บ Caseboard', web_sheet_id: '(ระบบใช้) ชีทที่ลิงก์เว็บนี้ Deploy ไว้'
};
var NOTE_HEADER = ['วันเวลา', 'case id', 'เตียง', 'วอร์ด', 'ผู้รับ', 'ประเภท', 'ข้อความ', 'ผู้จด', 'บันทึกเมื่อ', 'id', 'แก้ไขล่าสุด', 'ข้อความ (จัดรูปแบบ)'];
var NOTE_TYPES = ['progress', 'order', 'lab', 'wait', 'other'];
var TPL_HEADER = ['ชื่อ', 'ประเภท', 'ข้อความ', 'ผู้สร้าง', 'แก้ไขล่าสุด', 'id'];
var IMG_HEADER = ['วันที่ภาพ', 'case id', 'เตียง', 'วอร์ด', 'ผู้รับ', 'ชนิด', 'ท่า / ส่วน', 'รายละเอียด / ผลอ่าน',
                  'fileId', 'thumbId', 'ผู้อัปโหลด', 'อัปโหลดเมื่อ', 'id'];
var IMG_TYPES = ['xray', 'ct', 'mri', 'us', 'other'];
var DEFAULT_TEMPLATES = [
  ['Progress note (SOAP)', 'progress', 'HD __ — \nS: \nO: V/S BT __ BP __/__ PR __ RR __ SpO2 __%\n   PE: \nA: \nP: '],
  ['Admission note', 'progress', 'CC: \nPI: \nPH: \nPE: \nInvestigation: \nA: \nP: '],
  ['Post-op note', 'progress', 'POD __ s/p ________\nS: pain __/10, flatus __, voiding __, ambulation __\nO: V/S BT __ BP __/__ PR __\n   Wound: \n   I/O: in __ / out __\nA: \nP: '],
  ['Pre-op checklist', 'order', 'Pre-op for ________ วันที่ __/__\n☐ NPO after midnight\n☐ Consent signed\n☐ Lab: CBC, BUN/Cr, electrolyte\n☐ G/M __ U\n☐ CXR / EKG (ถ้ามีข้อบ่งชี้)\nNote: '],
  ['รอผล / รอทำ', 'wait', 'รอ: \n☐ \n☐ \nติดตามเมื่อ: '],
  ['Discharge plan', 'other', 'D/C plan: \nยากลับบ้าน: \nนัด F/U: \nคำแนะนำ: ']
];

/* ---------- entry points ---------- */

function doGet() {
  syncWebUrl_();
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle(readConfig_().name || 'Caseboard')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🩺 Caseboard')
    .addItem('เปิดแผงด้านข้าง', 'showSidebar')
    .addItem('เปิดหน้าต่างใหญ่', 'showDialog')
    .addItem('🚀 Deploy เว็บ / ใส่ลิงก์', 'openDeployHelper')
    .addItem('🔧 สร้างปุ่ม 🚀 ใหม่ (ถ้าปุ่มหาย / กดไม่ได้)', 'rebuildDeployButton')
    .addSeparator()
    .addItem('ตั้งค่าเริ่มต้น (สร้างแท็บที่ต้องใช้)', 'setupCaseboard')
    .addItem('สร้างสำเนา Template (ล้างข้อมูลคนไข้)', 'makeTemplateCopy')
    .addToUi();
  // ชีทที่ถูกทำสำเนามา (File → Make a copy / ลิงก์ /copy) ยังมีลิงก์เว็บของชีทต้นฉบับ → ล้างทิ้ง ให้ Deploy ของตัวเอง
  try {
    var cfg = readConfig_();
    if (cfg.web_url && cfg.web_sheet_id !== SpreadsheetApp.getActive().getId()) clearWebLink_();
  } catch (e) {}
}

function showSidebar() {
  SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutputFromFile('Index').setTitle('Caseboard'));
}

function showDialog() {
  SpreadsheetApp.getUi().showModelessDialog(HtmlService.createHtmlOutputFromFile('Index').setWidth(1100).setHeight(760), 'Caseboard');
}

// รันครั้งเดียวจากเมนู หรือปล่อยให้เว็บสร้างเองตอนเปิดครั้งแรกก็ได้
function setupCaseboard() {
  ensureAll_();
  var home = SpreadsheetApp.getActive().getSheetByName(SH.HOME);
  try { SpreadsheetApp.getActive().setActiveSheet(home); } catch (e) {}
  if (readConfig_().web_url) {
    try { SpreadsheetApp.getUi().alert('พร้อมใช้งาน ✓\n\nเปิดเว็บได้จากลิงก์ในแท็บ "Caseboard" ช่อง C1'); } catch (e) {}
  } else {
    openDeployHelper();   // ยังไม่มีลิงก์ → พาไป Deploy ต่อเลย
  }
}

/* ---------- โครงชีท ---------- */

function sheet_(name, header, setup) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold').setBackground('#f3ece6');
    sh.setFrozenRows(1);
    if (setup) setup(sh);
  }
  return sh;
}

function ensureAll_() {
  var team = sheet_(SH.TEAM, ['ชื่อ', 'avatar', 'ลำดับ']);
  var att = sheet_(SH.ATT, ['ชื่ออาจารย์']);
  var wards = sheet_(SH.WARDS, ['วอร์ด', 'ที่ตั้ง (เช่น ชั้น / ตึก)']);
  sheet_(SH.DUTY, ['วันที่', 'เวร'], function (sh) { sh.getRange('A:A').setNumberFormat('yyyy-mm-dd'); });
  sheet_(SH.CONFIG, ['key', 'value', 'คำอธิบาย'], function (sh) {
    var rows = Object.keys(DEFAULT_CONFIG).map(function (k) { return [k, DEFAULT_CONFIG[k], CONFIG_LABELS[k] || '']; });
    rows[0][1] = SpreadsheetApp.getActive().getName();
    sh.getRange(2, 1, rows.length, 3).setValues(rows);
    sh.setColumnWidth(3, 320);
  });
  sheet_(SH.CASES, CASE_HEADER, function (sh) {
    sh.getRange('C:C').setNumberFormat('yyyy-mm-dd');
    sh.getRange('J:J').setNumberFormat('@');
    sh.getRange('Q:R').setNumberFormat('yyyy-mm-dd HH:mm');
    sh.hideColumns(C.id);
    var n = 999;
    var dv = SpreadsheetApp.newDataValidation();
    sh.getRange(2, C.status, n, 1).setDataValidation(dv.requireValueInList([ACTIVE, DC], true).build());
    sh.getRange(2, C.consult, n, 2).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Y', 'N'], true).build());
    sh.getRange(2, C.assignee, n, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInRange(team.getRange('A2:A'), true).setAllowInvalid(true).build());
    sh.getRange(2, C.ward, n, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInRange(wards.getRange('A2:A'), true).setAllowInvalid(true).build());
    sh.getRange(2, C.attending, n, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInRange(att.getRange('A2:A'), true).setAllowInvalid(true).build());
  });
  notesSheet_();
  homeSheet_();
}

/* ---------- read ---------- */

function readConfig_() {
  var out = {};
  Object.keys(DEFAULT_CONFIG).forEach(function (k) { out[k] = DEFAULT_CONFIG[k]; });
  var sh = SpreadsheetApp.getActive().getSheetByName(SH.CONFIG);
  if (sh && sh.getLastRow() >= 2) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (r) {
      var k = String(r[0]).trim();
      if (!k) return;
      out[k] = typeof DEFAULT_CONFIG[k] === 'number' ? (isFinite(parseFloat(r[1])) ? parseFloat(r[1]) : DEFAULT_CONFIG[k]) : String(r[1]);
    });
  }
  return out;
}

function writeConfig_(obj) {
  var sh = SpreadsheetApp.getActive().getSheetByName(SH.CONFIG);
  var last = sh.getLastRow();
  var keys = last >= 2 ? sh.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return String(r[0]).trim(); }) : [];
  Object.keys(obj).forEach(function (k) {
    var i = keys.indexOf(k);
    if (i >= 0) sh.getRange(i + 2, 2).setValue(obj[k]);
    else { sh.appendRow([k, obj[k], CONFIG_LABELS[k] || '']); keys.push(k); }
  });
}

function rows_(name, cols) {
  var sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, cols).getValues();
}

function readTeam_() {
  return rows_(SH.TEAM, 3).map(function (r, i) { return { name: String(r[0]).trim(), avatar: String(r[1]).trim(), order: Number(r[2]) || i + 1 }; })
    .filter(function (p) { return p.name; })
    .sort(function (a, b) { return a.order - b.order; });
}
function readAttendings_() { return rows_(SH.ATT, 1).map(function (r) { return String(r[0]).trim(); }).filter(String); }
function readWards_() {
  return rows_(SH.WARDS, 2).map(function (r) { return { name: String(r[0]).trim(), loc: String(r[1]).trim() }; }).filter(function (w) { return w.name; });
}

function tz_() { return Session.getScriptTimeZone() || 'Asia/Bangkok'; }
function ymd_(d) {
  if (d instanceof Date && !isNaN(d.getTime())) return Utilities.formatDate(d, tz_(), 'yyyy-MM-dd');
  var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(d || ''));
  return m ? m[1] + '-' + pad_(+m[2]) + '-' + pad_(+m[3]) : '';
}
function los_(admit) {
  if (!admit) return null;
  var today = ymd_(new Date());
  return Math.round((Date.parse(today + 'T00:00:00Z') - Date.parse(admit + 'T00:00:00Z')) / 864e5);
}

function readCases_(cfg) {
  return rows_(SH.CASES, CASE_HEADER.length).map(function (r, i) {
    var name = String(r[C.name - 1]).trim();
    if (!name || !String(r[C.id - 1]).trim()) return null;
    var admit = ymd_(r[C.admit - 1]), dc = String(r[C.status - 1]).trim() === DC, d = los_(admit);
    return {
      key: String(r[C.id - 1]), row: i + 2, assignee: String(r[C.assignee - 1]).trim(), admit: admit,
      status: dc ? 'dc' : 'active',
      doy: dc ? '-' : d == null ? 'N' : d > cfg.sdoy_days ? 'SD' : d > cfg.doy_days ? 'D' : 'N',
      consult: String(r[C.consult - 1]).trim() === 'Y', wound: String(r[C.wound - 1]).trim() === 'Y',
      ward: String(r[C.ward - 1]).trim(), bed: String(r[C.bed - 1]).trim(), name: name, hn: String(r[C.hn - 1]).trim(),
      age: String(r[C.age - 1]).trim(), attending: String(r[C.attending - 1]).trim(),
      cc: String(r[C.cc - 1]), dx: String(r[C.dx - 1]), plan: String(r[C.plan - 1]), note: String(r[C.note - 1])
    };
  }).filter(Boolean);
}

function weight_(k, cfg) {
  if (k.status === 'dc') return cfg.w_dc;
  var b = k.consult ? cfg.w_consult : k.doy === 'SD' ? cfg.w_sdoy : k.doy === 'D' ? cfg.w_doy : cfg.w_active;
  return b + (k.wound ? cfg.w_wound : 0);
}

function persons_(team, cases, cfg) {
  return team.map(function (t) {
    var mine = cases.filter(function (k) { return k.assignee === t.name; });
    var act = mine.filter(function (k) { return k.status === 'active'; });
    return {
      name: t.name, total: mine.length, dc: mine.length - act.length, active: act.length, hold: act.length,
      consult: act.filter(function (k) { return k.consult; }).length, wound: act.filter(function (k) { return k.wound; }).length,
      doy: act.filter(function (k) { return k.doy === 'D'; }).length, sdoy: act.filter(function (k) { return k.doy === 'SD'; }).length,
      score: Math.round(mine.reduce(function (a, k) { return a + weight_(k, cfg); }, 0) * 100) / 100
    };
  });
}

function readDuty_() {
  var map = {};
  rows_(SH.DUTY, 2).forEach(function (r) { var d = ymd_(r[0]); if (d) map[d] = String(r[1]).trim(); });
  var t = new Date(), day = function (n) { var x = new Date(t.getTime() + n * 864e5); return ymd_(x); };
  return { yesterday: map[day(-1)] || '', today: map[day(0)] || '', tomorrow: map[day(1)] || '', map: map };
}

function getBoard() {
  ensureAll_();
  var ss = SpreadsheetApp.getActive();
  var cfg = readConfig_(), team = readTeam_(), cases = readCases_(cfg), wards = readWards_();
  var url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (e) {}
  var profiles = {};
  team.forEach(function (t) { if (t.avatar) profiles[t.name] = t.avatar; });
  return {
    config: { name: cfg.name, subtitle: cfg.subtitle, assign_mode: cfg.assign_mode === 'manual' ? 'manual' : 'wheel', w_active: cfg.w_active, w_dc: cfg.w_dc, w_consult: cfg.w_consult,
              w_wound: cfg.w_wound, w_doy: cfg.w_doy, w_sdoy: cfg.w_sdoy, doy_days: cfg.doy_days, sdoy_days: cfg.sdoy_days },
    persons: persons_(team, cases, cfg),
    team: team.map(function (t) { return t.name; }),
    duty: readDuty_(),
    cases: cases,
    wards: wards,
    wardOptions: wards.map(function (w) { return w.name; }),
    attendings: readAttendings_(),
    notes: readNotes_(),
    templates: readTemplates_(),
    imaging: readImaging_(),
    profiles: profiles,
    me: Session.getActiveUser().getEmail() || '',
    webUrl: url,
    sheetUrl: ss.getUrl(),
    at: new Date().toISOString()
  };
}

/* ---------- เขียนเคส ---------- */

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try { return fn(); } finally { lock.releaseLock(); }
}

// หาแถวจาก id (คอลัมน์ A) — ไม่พึ่งเลขแถว เผื่อมีคน sort ชีท
function findRows_(keys) {
  var sh = SpreadsheetApp.getActive().getSheetByName(SH.CASES);
  var last = sh.getLastRow();
  var ids = last >= 2 ? sh.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
  return keys.map(function (k) {
    var i = ids.indexOf(String(k));
    if (i < 0) throw new Error('ไม่พบเคสนี้ในชีทแล้ว กดรีเฟรชแล้วลองใหม่ — ยังไม่ได้เขียนอะไรลงชีท');
    return i + 2;
  });
}
function keyOf_(ref) { return typeof ref === 'object' && ref ? ref.key : ref; }
function casesSheet_() { return SpreadsheetApp.getActive().getSheetByName(SH.CASES); }

function addCase(c) {
  ensureAll_();
  c = c || {};
  var name = String(c.name || '').trim();
  if (!name) throw new Error('ใส่ชื่อคนไข้ก่อน');
  var admit = c.admit ? new Date(String(c.admit) + 'T00:00:00') : new Date();
  if (isNaN(admit.getTime())) admit = new Date();
  var team = readTeam_().map(function (t) { return t.name; });
  var who = String(c.assignee || '').trim();
  if (who && team.indexOf(who) < 0) throw new Error('ไม่พบ "' + who + '" ในรายชื่อคนรับเคส');
  return withLock_(function () {
    var row = [];
    row[C.id - 1] = Utilities.getUuid().slice(0, 8);
    row[C.assignee - 1] = who;
    row[C.admit - 1] = admit;
    row[C.status - 1] = ACTIVE;
    row[C.consult - 1] = c.consult ? 'Y' : 'N';
    row[C.wound - 1] = c.wound ? 'Y' : 'N';
    row[C.ward - 1] = String(c.ward || '').trim();
    row[C.bed - 1] = String(c.bed || '').trim();
    row[C.name - 1] = name.slice(0, 120);
    row[C.hn - 1] = String(c.hn || '').trim();
    row[C.age - 1] = String(c.age || '').trim();
    row[C.attending - 1] = String(c.attending || '').trim();
    row[C.cc - 1] = String(c.cc || '').slice(0, 2000);
    row[C.dx - 1] = String(c.dx || '').slice(0, 2000);
    row[C.plan - 1] = String(c.plan || '').slice(0, 2000);
    row[C.note - 1] = '';
    row[C.dcAt - 1] = '';
    row[C.createdAt - 1] = new Date();
    casesSheet_().appendRow(row);
    return getBoard();
  });
}

var CASE_EDIT = { name: C.name, hn: C.hn, age: C.age, attending: C.attending, cc: C.cc, dx: C.dx, plan: C.plan, note: C.note, admit: C.admit };
function updateCase(key, f) {
  return withLock_(function () {
    var row = findRows_([keyOf_(key)])[0], sh = casesSheet_();
    Object.keys(CASE_EDIT).forEach(function (k) {
      if (!f || !Object.prototype.hasOwnProperty.call(f, k)) return;
      var v = String(f[k] == null ? '' : f[k]).slice(0, 2000);
      if (k === 'name' && !v.trim()) throw new Error('ชื่อคนไข้ว่างไม่ได้');
      if (k === 'admit') { var d = new Date(v + 'T00:00:00'); if (isNaN(d.getTime())) return; sh.getRange(row, C.admit).setValue(d); return; }
      sh.getRange(row, CASE_EDIT[k]).setValue(v);
    });
    return getBoard();
  });
}

function assignCase(key, person) {
  person = String(person || '').trim();
  return withLock_(function () {
    if (readTeam_().map(function (t) { return t.name; }).indexOf(person) < 0) throw new Error('ไม่พบ "' + person + '" ในรายชื่อคนรับเคส');
    var row = findRows_([keyOf_(key)])[0], sh = casesSheet_();
    var cur = sh.getRange(row, 1, 1, C.status).getValues()[0];
    var already = String(cur[C.assignee - 1]).trim();
    if (already && already !== person) throw new Error('เคสนี้มีผู้รับแล้ว (' + already + ') — อาจมีคนแจกไปก่อน กดรีเฟรช');
    if (String(cur[C.status - 1]).trim() === DC) throw new Error('เคสนี้ D/C แล้ว ไม่ต้องแจก');
    sh.getRange(row, C.assignee).setValue(person);
    return getBoard();
  });
}

// กำหนด / เปลี่ยน / เอาผู้รับออกเอง (ไม่ผ่านวงล้อ) — person = '' คือเอาผู้รับออก
function setAssignee(key, person) {
  person = String(person || '').trim();
  return withLock_(function () {
    if (person && readTeam_().map(function (t) { return t.name; }).indexOf(person) < 0) throw new Error('ไม่พบ "' + person + '" ในรายชื่อคนรับเคส');
    var row = findRows_([keyOf_(key)])[0];
    casesSheet_().getRange(row, C.assignee).setValue(person);
    return getBoard();
  });
}

function dischargeCases(list) {
  return withLock_(function () {
    var sh = casesSheet_(), now = new Date();
    findRows_((list || []).map(keyOf_)).forEach(function (row) { sh.getRange(row, C.status).setValue(DC); sh.getRange(row, C.dcAt).setValue(now); });
    return getBoard();
  });
}

function undoDischarge(list) {
  return withLock_(function () {
    var sh = casesSheet_();
    findRows_((list || []).map(keyOf_)).forEach(function (row) { sh.getRange(row, C.status).setValue(ACTIVE); sh.getRange(row, C.dcAt).setValue(''); });
    return getBoard();
  });
}

function setCaseFlags(ref, flags) {
  return withLock_(function () {
    var row = findRows_([keyOf_(ref)])[0], sh = casesSheet_();
    if (flags && 'consult' in flags) sh.getRange(row, C.consult).setValue(flags.consult ? 'Y' : 'N');
    if (flags && 'wound' in flags) sh.getRange(row, C.wound).setValue(flags.wound ? 'Y' : 'N');
    return getBoard();
  });
}

function moveCase(ref, ward, bed) {
  ward = String(ward || '').trim(); bed = String(bed || '').trim();
  if (!ward || !bed) throw new Error('ใส่ทั้งวอร์ดและเตียง');
  return withLock_(function () {
    var row = findRows_([keyOf_(ref)])[0];
    casesSheet_().getRange(row, C.ward, 1, 2).setValues([[ward, bed.slice(0, 20)]]);
    return getBoard();
  });
}

/* ---------- ตั้งค่า (หน้าเว็บ → ตั้งค่า) ---------- */
// s = { config:{...}, team:[{name, old}], attendings:[{name, old}], wards:[{name, loc, old}], duty:[{date, name}] } — ส่งเฉพาะส่วนที่แก้
function saveSettings(s) {
  s = s || {};
  ensureAll_();
  return withLock_(function () {
    var ss = SpreadsheetApp.getActive(), cases = casesSheet_();
    var cfg = readConfig_(), all = readCases_(cfg);

    function renameIn(col, pairs) {
      if (!pairs.length || cases.getLastRow() < 2) return;
      var rg = cases.getRange(2, col, cases.getLastRow() - 1, 1), v = rg.getValues(), changed = false;
      v.forEach(function (r) { pairs.forEach(function (p) { if (String(r[0]).trim() === p[0]) { r[0] = p[1]; changed = true; } }); });
      if (changed) rg.setValues(v);
    }
    function clean(list, field) {
      var seen = {};
      return (list || []).map(function (x) { x[field] = String(x[field] || '').trim().slice(0, 60); return x; })
        .filter(function (x) { if (!x[field] || seen[x[field]]) return false; seen[x[field]] = 1; return true; });
    }
    function rewrite(name, rows, width) {
      var sh = ss.getSheetByName(name);
      if (sh.getLastRow() >= 2) sh.getRange(2, 1, sh.getLastRow() - 1, width).clearContent();
      if (rows.length) sh.getRange(2, 1, rows.length, width).setValues(rows);
    }

    if (s.config) {
      var c = {};
      ['name', 'subtitle'].forEach(function (k) { if (k in s.config) c[k] = String(s.config[k] || '').trim().slice(0, 80); });
      ['w_active', 'w_dc', 'w_consult', 'w_wound', 'w_doy', 'w_sdoy', 'doy_days', 'sdoy_days'].forEach(function (k) {
        if (k in s.config) { var n = parseFloat(s.config[k]); if (isFinite(n) && n >= 0 && n <= 100) c[k] = n; }
      });
      if ('assign_mode' in s.config) c.assign_mode = s.config.assign_mode === 'manual' ? 'manual' : 'wheel';
      if (c.name === '') delete c.name;
      writeConfig_(c);
      if (c.name) try { ss.getSheetByName(SH.HOME).getRange('A1').setValue('🩺 ' + c.name); } catch (e) {}
    }

    if (s.team) {
      var team = clean(s.team, 'name'), oldTeam = readTeam_();
      var keep = team.map(function (t) { return t.old || t.name; });
      oldTeam.forEach(function (o) {
        if (keep.indexOf(o.name) >= 0) return;
        var n = all.filter(function (k) { return k.assignee === o.name && k.status === 'active'; }).length;
        if (n) throw new Error('ลบ "' + o.name + '" ไม่ได้ — ยังถือเคส active อยู่ ' + n + ' เคส (ย้ายเคสหรือ D/C ก่อน)');
      });
      var avatars = {};
      oldTeam.forEach(function (o) { avatars[o.name] = o.avatar; });
      renameIn(C.assignee, team.filter(function (t) { return t.old && t.old !== t.name; }).map(function (t) { return [t.old, t.name]; }));
      rewrite(SH.TEAM, team.map(function (t, i) { return [t.name, avatars[t.old || t.name] || '', i + 1]; }), 3);
    }

    if (s.attendings) {
      var att = clean(s.attendings, 'name');
      renameIn(C.attending, att.filter(function (t) { return t.old && t.old !== t.name; }).map(function (t) { return [t.old, t.name]; }));
      rewrite(SH.ATT, att.map(function (t) { return [t.name]; }), 1);
    }

    if (s.wards) {
      var wards = clean(s.wards, 'name'), keepW = wards.map(function (w) { return w.old || w.name; });
      readWards_().forEach(function (o) {
        if (keepW.indexOf(o.name) >= 0) return;
        var n = all.filter(function (k) { return k.ward === o.name && k.status === 'active'; }).length;
        if (n) throw new Error('ลบวอร์ด "' + o.name + '" ไม่ได้ — ยังมีคนไข้ active อยู่ ' + n + ' ราย');
      });
      renameIn(C.ward, wards.filter(function (w) { return w.old && w.old !== w.name; }).map(function (w) { return [w.old, w.name]; }));
      rewrite(SH.WARDS, wards.map(function (w) { return [w.name, String(w.loc || '').trim().slice(0, 80)]; }), 2);
    }

    if (s.duty) {
      var map = readDuty_().map;
      s.duty.forEach(function (d) { var k = ymd_(d.date); if (k) map[k] = String(d.name || '').trim(); });
      var keys = Object.keys(map).filter(function (k) { return map[k]; }).sort();
      rewrite(SH.DUTY, keys.map(function (k) { return [k, map[k]]; }), 2);
    }
    return getBoard();
  });
}

function setAvatar(person, avatar) {
  person = String(person || '').trim();
  avatar = String(avatar || '').trim();
  if (avatar && !/^av\d{2}$/.test(avatar)) throw new Error('avatar ไม่ถูกต้อง');
  return withLock_(function () {
    var sh = SpreadsheetApp.getActive().getSheetByName(SH.TEAM), last = sh.getLastRow();
    var names = last >= 2 ? sh.getRange(2, 1, last - 1, 1).getValues() : [];
    for (var i = 0; i < names.length; i++) if (String(names[i][0]).trim() === person) {
      sh.getRange(i + 2, 2).setValue(avatar);
      var out = {};
      readTeam_().forEach(function (t) { if (t.avatar) out[t.name] = t.avatar; });
      return out;
    }
    throw new Error('ไม่พบ "' + person + '" ในรายชื่อคนรับเคส');
  });
}

/* ---------- ทำสำเนา Template (ไม่แตะชีทตัวจริง) ---------- */
function makeTemplateCopy() {
  var ss = SpreadsheetApp.getActive();
  var copy = ss.copy(readConfig_().name + ' — Template');
  [SH.CASES, SH.NOTES, SH.IMG, SH.DUTY, SH.TEAM].forEach(function (n) {
    var sh = copy.getSheetByName(n);
    if (sh && sh.getLastRow() >= 2) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
  });
  var cfg = copy.getSheetByName(SH.CONFIG);
  if (cfg && cfg.getLastRow() >= 2) {
    var v = cfg.getRange(2, 1, cfg.getLastRow() - 1, 2).getValues();
    v.forEach(function (r) { if (['sheet_id', 'imaging_folder_id', 'web_url', 'web_sheet_id'].indexOf(r[0]) >= 0) r[1] = ''; });
    cfg.getRange(2, 1, v.length, 2).setValues(v);
  }
  var home = copy.getSheetByName(SH.HOME);
  if (home) setHomeLink_(home, '');
  var url = copy.getUrl();
  try {
    SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(
      '<div style="font-family:sans-serif;line-height:1.6">สร้างสำเนาแล้ว (ล้างคนไข้, notes, ภาพ, ทีม, เวร ออกหมด)<br><a href="' + url +
      '" target="_blank">เปิดสำเนา Template</a><br><br>แชร์ให้กลุ่มอื่นด้วยลิงก์ที่เปลี่ยน <b>/edit</b> ท้ายลิงก์เป็น <b>/copy</b> — คนเปิดจะได้ชีท + สคริปต์ชุดของตัวเอง แล้ว Deploy เว็บของกลุ่มตัวเองครั้งเดียว</div>'
    ).setWidth(460).setHeight(220), 'Template พร้อมแชร์');
  } catch (e) {}
  return url;
}

/* ---------- แท็บ "Caseboard" (หน้าแรกของชีท) + ปุ่ม Deploy + ลิงก์เว็บที่ C1:E1 ---------- */
// Apps Script ไม่ยอมให้สคริปต์กด Deploy เองได้ (ต้องเปิด Apps Script API + ขอสิทธิ์เพิ่มจากทุกคน)
// จึงทำเป็นปุ่มพาไปหน้า Deploy + ช่องวางลิงก์ และเติมลิงก์ให้อัตโนมัติเมื่อมีคนเปิดเว็บครั้งแรก

var HOME_LINK = 'C1:E1';
var HOME_EMPTY = '⚠️ ยังไม่ได้ Deploy — กดปุ่ม 🚀 ด้านล่าง';
var HOME_STEPS = [
  ['วิธี Deploy เว็บ (ทำครั้งเดียวต่อชีท)', true],
  ['1.  กดปุ่ม 🚀 ด้านบน → กด "เปิดหน้า Apps Script"'],
  ['2.  ในหน้า Apps Script กด Deploy (มุมขวาบน) → New deployment → ⚙️ Select type → Web app'],
  ['3.  Execute as: User accessing the web app   |   Who has access: Anyone with Google account (หรือ ภายในองค์กร)'],
  ['4.  กด Deploy → Authorize access → เลือกบัญชี → Allow'],
  ['5.  คัดลอก Web app URL (ลงท้ายด้วย /exec) → กลับมาวางในหน้าต่างปุ่ม 🚀 → บันทึก  — ลิงก์จะขึ้นที่ช่อง C1'],
  ['6.  แชร์ชีทนี้ (สิทธิ์ Editor) ให้ทุกคนในทีม แล้วให้ทุกคนกดลิงก์ C1 เปิดเว็บ', false],
  [''],
  ['หมายเหตุ', true],
  ['•  กดปุ่มไม่ได้ (เช่นบนมือถือ/แท็บเล็ต) → ใช้เมนู 🩺 Caseboard → 🚀 Deploy เว็บ / ใส่ลิงก์ บนคอมพิวเตอร์'],
  ['•  แก้โค้ดแล้วอยากให้เว็บอัปเดต: Deploy → Manage deployments → ✏️ → Version: New version → Deploy (ลิงก์เดิมใช้ต่อได้)'],
  ['•  ทำสำเนาชีท (File → Make a copy) ต้อง Deploy ใหม่ในสำเนา — ลิงก์ของชีทต้นฉบับจะถูกล้างให้เองตอนเปิดสำเนา'],
  ['•  ข้อมูลคนไข้อยู่ในแท็บ Cases · รายชื่อทีม / อาจารย์ / วอร์ด / เวร แก้ได้จากหน้าเว็บ → ตั้งค่า']
];

function homeSheet_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SH.HOME);
  if (sh) return sh;
  sh = ss.insertSheet(SH.HOME, 0);
  try { sh.setHiddenGridlines(true); } catch (e) {}
  sh.setColumnWidth(1, 190); sh.setColumnWidth(2, 130);
  [3, 4, 5].forEach(function (c) { sh.setColumnWidth(c, 230); });
  sh.setRowHeight(1, 44);
  sh.getRange('A1').setValue('🩺 ' + (readConfig_().name || 'Caseboard')).setFontSize(16).setFontWeight('bold').setFontColor('#7b2d55');
  sh.getRange('B1').setValue('ลิงก์เว็บแอป →').setFontWeight('bold').setFontColor('#6b6268').setHorizontalAlignment('right');
  sh.getRange('A1:E1').setVerticalAlignment('middle');
  sh.getRange('A2').setValue('กดปุ่มด้านล่างเพื่อ Deploy เว็บ — ลิงก์จะมาแสดงที่ช่อง C1 ให้ทุกคนในทีมกดเปิดได้ทันที').setFontColor('#6b6268');
  sh.setRowHeight(4, 86);
  HOME_STEPS.forEach(function (s, i) {
    var r = sh.getRange(6 + i, 1).setValue(s[0]);
    if (s[1]) r.setFontWeight('bold').setFontColor('#7b2d55');
  });
  insertDeployButton_(sh);
  var cfg = readConfig_();
  setHomeLink_(sh, cfg.web_url && cfg.web_sheet_id === ss.getId() ? cfg.web_url : '');
  return sh;
}

function insertDeployButton_(sh) {
  try {
    var img = sh.insertImage(Utilities.newBlob(Utilities.base64Decode(DEPLOY_BTN_PNG), 'image/png', 'deploy-button.png'), 1, 4, 6, 6);
    img.setWidth(324).setHeight(73);
    img.assignScript('openDeployHelper');
    try { img.setAltTextTitle('Deploy เว็บ / ใส่ลิงก์'); } catch (e) {}
    return true;
  } catch (e) {
    sh.getRange('A4').setValue('🚀 เมนู Caseboard → Deploy เว็บ / ใส่ลิงก์').setFontWeight('bold');
    return false;
  }
}

// เมนู "🔧 สร้างปุ่ม 🚀 ใหม่" — ใช้เมื่อปุ่มถูกลบ / ย้าย / หลุดสคริปต์ (ลบปุ่มเก่าในแท็บ Caseboard แล้ววางใหม่)
function rebuildDeployButton() {
  var ss = SpreadsheetApp.getActive();
  if (!ss.getSheetByName(SH.HOME)) {          // แท็บหายทั้งแท็บ → สร้างใหม่พร้อมปุ่มในตัว
    ensureAll_();
    try { ss.setActiveSheet(ss.getSheetByName(SH.HOME)); ss.toast('สร้างแท็บ Caseboard + ปุ่ม 🚀 ใหม่แล้ว', 'Caseboard', 6); } catch (e) {}
    return { ok: true, removed: 0, recreated: true };
  }
  var sh = homeSheet_();
  var removed = 0;
  try {
    sh.getImages().forEach(function (img) {
      var t = '', a = '';
      try { t = img.getAltTextTitle() || ''; } catch (e) {}
      try { a = img.getScript() || ''; } catch (e) {}
      var cell = img.getAnchorCell();
      var nearButton = cell.getColumn() <= 2 && cell.getRow() >= 2 && cell.getRow() <= 5;
      if (/Deploy/.test(t) || a === 'openDeployHelper' || nearButton) { img.remove(); removed++; }
    });
  } catch (e) {}
  if (sh.getRange('A4').getValue()) sh.getRange('A4').clearContent();
  sh.setRowHeight(4, 86);
  var ok = insertDeployButton_(sh);
  try { ss.setActiveSheet(sh); } catch (e) {}
  try {
    ss.toast(ok ? 'วางปุ่ม 🚀 ใหม่แล้ว' + (removed ? ' (ลบปุ่มเก่า ' + removed + ' ปุ่ม)' : '') + ' — กดได้เลย' : 'วางปุ่มไม่ได้ ใช้เมนู 🩺 Caseboard → 🚀 แทน', 'Caseboard', 6);
  } catch (e) {}
  return { ok: ok, removed: removed };
}

// เขียนเฉพาะเซลล์ C1:E1 (ไม่แตะ Config)
function setHomeLink_(sh, url) {
  var rg = sh.getRange(HOME_LINK);
  try { rg.merge(); } catch (e) {}
  rg.setVerticalAlignment('middle').setBackground(url ? '#eef6f1' : '#fff4e5').setFontSize(11);
  var cell = sh.getRange(HOME_LINK.split(':')[0]);
  if (url) {
    cell.setRichTextValue(SpreadsheetApp.newRichTextValue().setText(url).setLinkUrl(url).build());
    cell.setFontColor('#1a5fb4').setFontWeight('bold');
  } else {
    cell.setValue(HOME_EMPTY).setFontColor('#8a560a').setFontWeight('bold');
  }
}

function writeWebLink_(url) {
  ensureAll_();
  setHomeLink_(homeSheet_(), url);
  writeConfig_({ web_url: url, web_sheet_id: url ? SpreadsheetApp.getActive().getId() : '' });
}
function clearWebLink_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SH.HOME);
  if (sh) setHomeLink_(sh, '');
  if (ss.getSheetByName(SH.CONFIG)) writeConfig_({ web_url: '', web_sheet_id: '' });
}

function cleanWebUrl_(u) {
  u = String(u || '').trim().replace(/[?#].*$/, '');
  return /^https:\/\/script\.google\.com\/(macros|a\/macros\/[^\/\s]+|a\/[^\/\s]+\/macros)\/s\/[\w-]+\/exec$/.test(u) ? u : '';
}

// เรียกตอนมีคนเปิดเว็บ: ถ้ายังไม่มีลิงก์ (หรือเป็นลิงก์ของชีทอื่น) → เติมให้เอง ไม่ทับลิงก์ที่ผู้ใช้วางไว้
function syncWebUrl_() {
  try {
    var u = cleanWebUrl_(ScriptApp.getService().getUrl());
    if (!u) return;
    var ss = SpreadsheetApp.getActive();
    if (!ss.getSheetByName(SH.CONFIG)) return;   // ยังไม่ setup — getBoard จะสร้างให้ แล้วรอบหน้าค่อยเติม
    var cfg = readConfig_();
    if (!cfg.web_url || cfg.web_sheet_id !== ss.getId()) writeWebLink_(u);
  } catch (e) {}
}

function saveWebUrl(url) {
  var raw = String(url || '').trim();
  if (!raw) { clearWebLink_(); return { ok: true, url: '' }; }
  var u = cleanWebUrl_(raw);
  if (!u) {
    if (/\/dev$/.test(raw.replace(/[?#].*$/, ''))) throw new Error('นี่คือลิงก์ทดสอบ (/dev) ใช้ได้แค่คนเขียนโค้ด — ให้คัดลอก Web app URL ที่ลงท้ายด้วย /exec');
    throw new Error('ลิงก์ไม่ถูกต้อง — ต้องเป็น https://script.google.com/…/exec');
  }
  writeWebLink_(u);
  return { ok: true, url: u };
}

function detectWebUrl() {
  var got = '';
  try { got = ScriptApp.getService().getUrl() || ''; } catch (e) {}
  var u = cleanWebUrl_(got);
  if (u) writeWebLink_(u);
  return { ok: !!u, url: u, got: got };
}

function openDeployHelper() {
  ensureAll_();
  var cfg = readConfig_(), ss = SpreadsheetApp.getActive();
  var cur = cfg.web_url && cfg.web_sheet_id === ss.getId() ? cfg.web_url : '';
  var editor = 'https://script.google.com/home/projects/' + ScriptApp.getScriptId() + '/edit';
  var esc = function (x) { return String(x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var html =
    '<style>body{font:14px/1.55 "Sarabun",system-ui,sans-serif;color:#1f1a1d;margin:0;padding:4px 6px}' +
    'h3{margin:14px 0 6px;font-size:14px;color:#7b2d55}ol{margin:0;padding-left:20px}li{margin:3px 0}b{color:#2b1823}' +
    '.btn{display:inline-block;border:0;border-radius:10px;padding:9px 16px;font-weight:600;font-size:14px;font-family:inherit;cursor:pointer;text-decoration:none}' +
    '.pri{background:#7b2d55;color:#fff}.sec{background:#f3ece6;color:#2b1823}' +
    'input{width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid #d9cfc6;border-radius:10px;font:13px monospace;margin:6px 0}' +
    '.cur{background:#eef6f1;border-radius:10px;padding:8px 10px;word-break:break-all;font-size:13px}.no{background:#fff4e5}' +
    '#msg{min-height:20px;margin-top:6px;font-size:13px}.ok{color:#2d6e4c}.err{color:#a2372d}.row{display:flex;gap:8px;flex-wrap:wrap}</style>' +
    '<div class="cur' + (cur ? '' : ' no') + '" id="cur">' + (cur ? 'ลิงก์ปัจจุบัน: <a href="' + esc(cur) + '" target="_blank">' + esc(cur) + '</a>' : 'ยังไม่มีลิงก์เว็บ') + '</div>' +
    '<h3>① เปิดหน้า Apps Script</h3>' +
    '<a class="btn pri" href="' + esc(editor) + '" target="_blank">เปิดหน้า Apps Script ↗</a>' +
    '<h3>② Deploy เป็น Web app</h3><ol>' +
    '<li>กด <b>Deploy</b> (มุมขวาบน) → <b>New deployment</b></li>' +
    '<li>⚙️ <b>Select type</b> → <b>Web app</b></li>' +
    '<li>Execute as: <b>User accessing the web app</b></li>' +
    '<li>Who has access: <b>Anyone with Google account</b> (หรือ ภายในองค์กร)</li>' +
    '<li>กด <b>Deploy</b> → Authorize → Allow → คัดลอก <b>Web app URL</b> (ลงท้าย <b>/exec</b>)</li></ol>' +
    '<p style="margin:6px 0 0;color:#6b6268;font-size:12.5px">เคย Deploy แล้วแต่แก้โค้ด → Deploy → Manage deployments → ✏️ → Version: New version (ลิงก์เดิม)</p>' +
    '<h3>③ วางลิงก์ แล้วบันทึกลงช่อง C1</h3>' +
    '<input id="u" placeholder="https://script.google.com/macros/s/…/exec" value="' + esc(cur) + '">' +
    '<div class="row"><button class="btn pri" id="save">บันทึกลิงก์</button>' +
    '<button class="btn sec" id="auto">ตรวจหาอัตโนมัติ</button>' +
    '<button class="btn sec" onclick="google.script.host.close()">ปิด</button></div><div id="msg"></div>' +
    '<script>var $=function(i){return document.getElementById(i)};' +
    'function say(t,ok){$("msg").className=ok?"ok":"err";$("msg").textContent=t}' +
    'function done(r){if(r&&r.url){say("บันทึกแล้ว ✓ ลิงก์อยู่ที่แท็บ Caseboard ช่อง C1",1);$("u").value=r.url;$("cur").className="cur";$("cur").innerHTML="ลิงก์ปัจจุบัน: <a target=_blank href=\\""+r.url+"\\">"+r.url+"</a>"}' +
    'else if(r&&r.ok){say("ล้างลิงก์แล้ว",1)}else{say("ยังหาไม่เจอ — ทำขั้นที่ ② ให้เสร็จ แล้ววางลิงก์ /exec ในช่องด้านบน",0)}}' +
    'function fail(e){say(e.message||String(e),0)}' +
    '$("save").onclick=function(){say("กำลังบันทึก…",1);google.script.run.withSuccessHandler(done).withFailureHandler(fail).saveWebUrl($("u").value)};' +
    '$("auto").onclick=function(){say("กำลังตรวจหา…",1);google.script.run.withSuccessHandler(done).withFailureHandler(fail).detectWebUrl()};' +
    '<\/script>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(520).setHeight(600), '🚀 Deploy เว็บ Caseboard');
}

/* ---------- imaging (ภาพใน Drive + ข้อมูลในแท็บ "Imaging") ---------- */

function imagingSheet_() {
  return sheet_(SH.IMG, IMG_HEADER, function (sh) {
    sh.getRange('A:B').setNumberFormat('@');
    sh.getRange('L:L').setNumberFormat('yyyy-mm-dd HH:mm');
    sh.setColumnWidth(8, 360);
  });
}

function readImaging_() {
  return rows_(SH.IMG, IMG_HEADER.length).filter(function (r) { return r[12] && r[8]; }).map(function (r) {
    return { date: String(r[0]), key: String(r[1]), bed: r[2], ward: r[3], assignee: r[4], type: String(r[5]),
             view: String(r[6]), desc: String(r[7]), fileId: String(r[8]), thumbId: String(r[9]),
             uploader: String(r[10]), uploadedAt: iso_(r[11]), id: String(r[12]) };
  });
}

// โฟลเดอร์เก็บภาพของ "ชีทนี้" — สร้างเองครั้งแรกข้างๆ ไฟล์ชีท ถ้าชีทถูก copy มาจะสร้างโฟลเดอร์ใหม่ ไม่ใช้ของต้นฉบับ
function imagingFolder_() {
  var ss = SpreadsheetApp.getActive(), cfg = readConfig_();
  try {
    if (cfg.imaging_folder_id && cfg.sheet_id === ss.getId()) return DriveApp.getFolderById(cfg.imaging_folder_id);
    var parent;
    try { var it = DriveApp.getFileById(ss.getId()).getParents(); parent = it.hasNext() ? it.next() : DriveApp.getRootFolder(); }
    catch (e) { parent = DriveApp.getRootFolder(); }
    var f = parent.createFolder((cfg.name || ss.getName()) + ' — Imaging');
    writeConfig_({ sheet_id: ss.getId(), imaging_folder_id: f.getId() });
    return f;
  } catch (e) {
    var m = String(e && e.message || e);
    throw new Error('ใช้ Google Drive ไม่ได้ — รีโหลดหน้าเว็บแล้วกด Allow สิทธิ์ Drive หรือเช็กสิทธิ์โฟลเดอร์ [' + m + ']');
  }
}

function dataUriToBlob_(uri, name) {
  var m = /^data:([^;]+);base64,(.+)$/.exec(String(uri || ''));
  if (!m) throw new Error('ไฟล์รูปไม่ถูกต้อง');
  return Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], name);
}

function uploadImaging(meta, full, thumb) {
  if (!meta || !meta.key) throw new Error('ไม่รู้ว่าเป็นภาพของเคสไหน');
  var type = IMG_TYPES.indexOf(meta.type) >= 0 ? meta.type : 'other';
  var date = String(meta.date || Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd'));
  var base = [date, meta.bed || '', type, String(meta.view || '').replace(/[^\wก-๙ -]/g, '')].join('_').slice(0, 80);
  var folder = imagingFolder_();
  return withLock_(function () {
    var f1 = folder.createFile(dataUriToBlob_(full, base + '.jpg'));
    var f2 = folder.createFile(dataUriToBlob_(thumb, base + '_thumb.jpg'));
    imagingSheet_().appendRow([date, String(meta.key), meta.bed || '', meta.ward || '', meta.assignee || '', type,
      String(meta.view || '').slice(0, 100), String(meta.desc || '').slice(0, 2000),
      f1.getId(), f2.getId(), Session.getActiveUser().getEmail() || '', new Date(), Utilities.getUuid()]);
    return readImaging_();
  });
}

// อ่านรูปเป็น data URI — อ่านได้เฉพาะไฟล์ที่อยู่ในแท็บ Imaging เท่านั้น
function getImages(ids) {
  ids = (ids || []).slice(0, 40).map(String);
  var allowed = {};
  readImaging_().forEach(function (x) { allowed[x.fileId] = 1; allowed[x.thumbId] = 1; });
  var out = {};
  ids.forEach(function (id) {
    if (!allowed[id]) return;
    try {
      var b = DriveApp.getFileById(id).getBlob();
      out[id] = 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes());
    } catch (e) { out[id] = ''; }
  });
  return out;
}

function updateImaging(id, meta) {
  var me = Session.getActiveUser().getEmail() || '';
  return withLock_(function () {
    var sh = imagingSheet_();
    var v = sh.getLastRow() < 2 ? [] : sh.getRange(2, 1, sh.getLastRow() - 1, IMG_HEADER.length).getValues();
    for (var i = 0; i < v.length; i++) {
      if (String(v[i][12]) !== String(id)) continue;
      if (!me || String(v[i][10]) !== me) throw new Error('แก้ได้เฉพาะภาพที่ตัวเองอัปโหลด');
      var type = IMG_TYPES.indexOf(meta.type) >= 0 ? meta.type : 'other';
      sh.getRange(i + 2, 1).setValue(String(meta.date || v[i][0]));
      sh.getRange(i + 2, 6, 1, 3).setValues([[type, String(meta.view || '').slice(0, 100), String(meta.desc || '').slice(0, 2000)]]);
      return readImaging_();
    }
    throw new Error('ไม่พบภาพนี้แล้ว');
  });
}

function deleteImaging(id) {
  var me = Session.getActiveUser().getEmail() || '';
  return withLock_(function () {
    var sh = imagingSheet_();
    var v = sh.getLastRow() < 2 ? [] : sh.getRange(2, 1, sh.getLastRow() - 1, IMG_HEADER.length).getValues();
    for (var i = 0; i < v.length; i++) {
      if (String(v[i][12]) !== String(id)) continue;
      if (!me || String(v[i][10]) !== me) throw new Error('ลบได้เฉพาะภาพที่ตัวเองอัปโหลด');
      [v[i][8], v[i][9]].forEach(function (fid) { try { DriveApp.getFileById(fid).setTrashed(true); } catch (e) {} });
      sh.deleteRow(i + 2);
      break;
    }
    return readImaging_();
  });
}

/* ---------- note templates (แท็บ "Templates") ---------- */

function templatesSheet_() {
  return sheet_(SH.TPL, TPL_HEADER, function (sh) {
    sh.setColumnWidth(3, 420);
    var now = new Date();
    sh.getRange(2, 1, DEFAULT_TEMPLATES.length, TPL_HEADER.length)
      .setValues(DEFAULT_TEMPLATES.map(function (t) { return [t[0], t[1], t[2], 'ค่าเริ่มต้น', now, Utilities.getUuid()]; }));
  });
}

function readTemplates_() {
  templatesSheet_();
  return rows_(SH.TPL, TPL_HEADER.length).filter(function (r) { return r[5] && String(r[0]).trim(); })
    .map(function (r) { return { id: String(r[5]), name: String(r[0]), type: String(r[1]), text: String(r[2]), author: String(r[3]) }; });
}

function findTemplateRow_(sh, id) {
  if (sh.getLastRow() < 2) return -1;
  var ids = sh.getRange(2, 6, sh.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}

function saveTemplate(t) {
  var name = String((t && t.name) || '').trim(), text = String((t && t.text) || '');
  if (!name) throw new Error('ตั้งชื่อ Template ก่อน');
  if (!text.trim()) throw new Error('Template ยังไม่มีข้อความ');
  var type = NOTE_TYPES.indexOf(t.type) >= 0 ? t.type : 'other';
  return withLock_(function () {
    var sh = templatesSheet_(), row = t.id ? findTemplateRow_(sh, t.id) : -1;
    if (row > 0) { sh.getRange(row, 1, 1, 3).setValues([[name.slice(0, 80), type, text.slice(0, 4000)]]); sh.getRange(row, 5).setValue(new Date()); }
    else sh.appendRow([name.slice(0, 80), type, text.slice(0, 4000), Session.getActiveUser().getEmail() || '', new Date(), Utilities.getUuid()]);
    return readTemplates_();
  });
}

function deleteTemplate(id) {
  return withLock_(function () {
    var sh = templatesSheet_(), row = findTemplateRow_(sh, id);
    if (row > 0) sh.deleteRow(row);
    return readTemplates_();
  });
}

/* ---------- notes ---------- */

function notesSheet_() {
  return sheet_(SH.NOTES, NOTE_HEADER, function (sh) {
    sh.getRange('B:B').setNumberFormat('@');
    sh.getRange('A:A').setNumberFormat('yyyy-mm-dd HH:mm');
    sh.getRange('I:I').setNumberFormat('yyyy-mm-dd HH:mm');
    sh.getRange('K:K').setNumberFormat('yyyy-mm-dd HH:mm');
    sh.setColumnWidth(7, 420);
  });
}

function readNotes_() {
  return rows_(SH.NOTES, NOTE_HEADER.length).filter(function (r) { return r[9]; }).map(function (r) {
    return { at: iso_(r[0]), key: String(r[1]), bed: r[2], ward: r[3], assignee: r[4], type: r[5], text: r[6], author: r[7],
             createdAt: iso_(r[8]), id: String(r[9]), editedAt: r[10] ? iso_(r[10]) : '', html: r[11] ? String(r[11]) : '' };
  });
}

function addNote(n) {
  var text = String((n && n.text) || '').trim();
  if (!text) throw new Error('พิมพ์ข้อความก่อนบันทึก');
  if (!n.key) throw new Error('ไม่รู้ว่าเป็นเคสไหน');
  var at = n.at ? new Date(n.at) : new Date();
  if (isNaN(at.getTime())) at = new Date();
  var type = NOTE_TYPES.indexOf(n.type) >= 0 ? n.type : 'other';
  return withLock_(function () {
    notesSheet_().appendRow([at, String(n.key), n.bed || '', n.ward || '', n.assignee || '', type,
      text.slice(0, 4000), Session.getActiveUser().getEmail() || '', new Date(), Utilities.getUuid(), '', richHtml_(n.html)]);
    return readNotes_();
  });
}

function updateNote(id, n) {
  var text = String((n && n.text) || '').trim();
  if (!text) throw new Error('ข้อความว่างไม่ได้ ถ้าจะเอาออกให้กดลบแทน');
  var at = n.at ? new Date(n.at) : null;
  var type = NOTE_TYPES.indexOf(n.type) >= 0 ? n.type : 'other';
  var me = Session.getActiveUser().getEmail() || '';
  return withLock_(function () {
    var sh = notesSheet_(), last = sh.getLastRow();
    var v = last < 2 ? [] : sh.getRange(2, 1, last - 1, NOTE_HEADER.length).getValues();
    for (var i = 0; i < v.length; i++) {
      if (String(v[i][9]) !== String(id)) continue;
      if (!me || String(v[i][7]) !== me) throw new Error('แก้ได้เฉพาะ note ที่ตัวเองเป็นคนจด');
      var row = i + 2;
      if (at && !isNaN(at.getTime())) sh.getRange(row, 1).setValue(at);
      sh.getRange(row, 6, 1, 2).setValues([[type, text.slice(0, 4000)]]);
      sh.getRange(row, 11, 1, 2).setValues([[new Date(), richHtml_(n.html)]]);
      return readNotes_();
    }
    throw new Error('ไม่พบ note นี้แล้ว อาจถูกลบไปก่อน');
  });
}

function deleteNote(id) {
  var me = Session.getActiveUser().getEmail() || '';
  return withLock_(function () {
    var sh = notesSheet_(), last = sh.getLastRow();
    if (last < 2) return readNotes_();
    var v = sh.getRange(2, 1, last - 1, NOTE_HEADER.length).getValues();
    for (var i = 0; i < v.length; i++) {
      if (String(v[i][9]) === String(id)) {
        if (!me || String(v[i][7]) !== me) throw new Error('ลบได้เฉพาะ note ที่ตัวเองเป็นคนจด');
        sh.deleteRow(i + 2);
        break;
      }
    }
    return readNotes_();
  });
}

/* ---------- helpers ---------- */

// note แบบจัดรูปแบบ: เก็บเฉพาะแท็กที่ปลอดภัย (หน้าเว็บกรองซ้ำอีกชั้นตอนแสดงผล)
function richHtml_(h) {
  h = String(h || '');
  if (!h) return '';
  h = h.replace(/<(script|style|iframe|object|embed|svg|math)[\s\S]*?<\/\1\s*>/gi, '')
       .replace(/<(?!\/?(b|i|u|br|div|ul|ol|li|font)(\s[^<>]*)?\/?>)[^<>]*>/gi, '')
       .replace(/<[^<>]+>/g, function (tag) {
         return tag.replace(/\s(on\w+|style|href|src|class|id)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
       });
  return h.length > 45000 ? '' : h;
}

function pad_(x) { return (x < 10 ? '0' : '') + x; }
function iso_(d) { return (d instanceof Date && !isNaN(d.getTime())) ? d.toISOString() : String(d || ''); }

// ปุ่ม "🚀 Deploy เว็บ / ใส่ลิงก์" ในแท็บ Caseboard (PNG 648×146, แสดง 324×73)
var DEPLOY_BTN_PNG = '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';
