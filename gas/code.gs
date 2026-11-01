/**
 * خادم "متابعة الدوام والانضباط" — مدرسة خالد بن الوليد الثانوية للبنين
 * يعمل داخل جدول Google نفسه (Extensions ← Apps Script).
 * لا يحتوي هذا الملف أي سرّ: رموز الدخول في ورقة "المستخدمون" داخل جدولك.
 * لا تغيّر ترتيب الأعمدة في الأوراق.
 */
var SH = {settings:'الإعدادات', users:'المستخدمون', sections:'الشعب', students:'الطلاب', teachers:'المعلمون',
  tt:'الجدول', days:'أيام الدوام', catalog:'قائمة المخالفات', att:'الحضور', marks:'تثبيت الشعب',
  notify:'سجل التواصل', viol:'المخالفات'};
var HEAD = {
  settings:['المفتاح','القيمة'],
  users:['الاسم','رمز الدخول','فعّال'],
  sections:['رقم الشعبة','الصف','الشعبة','الاسم الظاهر','الترتيب'],
  students:['رقم الطالب','الاسم','رقم الشعبة','المقعد','ذو إعاقة','فعّال'],
  teachers:['رقم المعلم','الاسم'],
  tt:['اليوم (0=الأحد)','الحصة','رقم الشعبة','رقم المعلم','المادة'],
  days:['التاريخ','الفصل'],
  catalog:['الرقم','الدرجة','البند','المخالفة','الوسم'],
  att:['رقم الطالب','التاريخ','الحالة','وقت التأخر','مخالفة زي','وقت المغادرة','سبب المغادرة','رصد الحالة','رصد التأخر','رصد الزي','رصد المغادرة','آخر تعديل'],
  marks:['رقم الشعبة','التاريخ','بواسطة','الوقت'],
  notify:['رقم الطالب','التاريخ','النوع','بواسطة','الوقت'],
  viol:['الرقم','رقم الطالب','التاريخ','الحصة','رقم المخالفة','ملاحظة','العقوبة المقترحة','تنبيهات','ملغاة','سبب الإلغاء','بواسطة','الوقت']
};
var TEXT_COLS = {days:[1], att:[2,4,6,12], marks:[2,4], notify:[2,5], viol:[3,12], users:[2]};
var STATUS = {present:1, absent:1, excused:1};
var KINDS = {absent:1, late:1, leave:1, uniform:1, violation:1, other:1};

function ss_(){ return SpreadsheetApp.getActive(); }
function tz_(){ return ss_().getSpreadsheetTimeZone() || 'Asia/Amman'; }
function sh_(k){ var s = ss_().getSheetByName(SH[k]); if(!s) throw new Error('الورقة غير موجودة: ' + SH[k]); return s; }
function rows_(k){ var s = sh_(k), n = s.getLastRow(); if(n < 2) return []; return s.getRange(2, 1, n - 1, HEAD[k].length).getValues(); }
function d2s_(v){ if(v instanceof Date) return Utilities.formatDate(v, tz_(), 'yyyy-MM-dd'); return String(v == null ? '' : v).trim(); }
function t2s_(v){ if(v === '' || v == null) return null; if(v instanceof Date) return Utilities.formatDate(v, tz_(), 'HH:mm'); var s = String(v).trim(); return s ? s.slice(0, 5) : null; }
function b_(v){ return v === true || v === 1 || /^(true|نعم|1)$/i.test(String(v).trim()); }
function n_(v){ return Number(v); }
function now_(){ return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd HH:mm:ss'); }
function json_(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function doGet(){ return json_({ok:true, msg:'خادم متابعة الدوام يعمل'}); }
function doPost(e){
  var out;
  try { out = handle_(JSON.parse(e.postData.contents)); }
  catch(err){ out = {ok:false, error:String(err && err.message || err)}; }
  return json_(out);
}

function who_(code){
  code = String(code || '').trim();
  if(code.length < 8) return null;
  var u = rows_('users');
  for(var i = 0; i < u.length; i++){
    if(String(u[i][1]).trim() === code && b_(u[i][2])) return {name:String(u[i][0]).trim()};
  }
  return null;
}

function handle_(q){
  var u = who_(q.code);
  if(!u) return {ok:false, code:'auth', error:'رمز الدخول غير صحيح أو موقوف'};
  switch(q.action){
    case 'login':      return {ok:true, user:u};
    case 'boot':       return boot_();
    case 'day':        return day_(String(q.day));
    case 'ops':        return ops_(u, q.ops || []);
    case 'history':    return history_(n_(q.sid));
    case 'disability': return disability_(n_(q.sid), !!q.v);
    default:           return {ok:false, error:'عملية غير معروفة'};
  }
}

function settings_(){
  var o = {};
  rows_('settings').forEach(function(r){
    var k = String(r[0]).trim(); if(!k) return;
    var v = r[1];
    if(typeof v === 'string'){ try { v = JSON.parse(v); } catch(e){} }
    o[k] = v;
  });
  return o;
}
function schoolDays_(){ var m = {}; rows_('days').forEach(function(r){ var d = d2s_(r[0]); if(d) m[d] = 1; }); return m; }
function students_(){
  return rows_('students').filter(function(r){ return r[0] !== '' && (r[5] === '' || b_(r[5])); }).map(function(r){
    return {id:n_(r[0]), name:String(r[1]).trim(), section_id:n_(r[2]), seat:r[3] === '' ? null : n_(r[3]), disability:b_(r[4]), active:true};
  });
}
function counts_(only){
  var st = settings_(), days = schoolDays_(), c = {};
  var Y = Number(st.year_days), r1 = Number(st.absence_rate), r2 = Number(st.absence_rate_disability);
  students_().forEach(function(s){
    if(only && !only[s.id]) return;
    c[s.id] = {days_absent:0, max_days:Math.floor(Y * (s.disability ? r2 : r1) + 1e-9)};
  });
  rows_('att').forEach(function(r){
    var sid = n_(r[0]), st2 = String(r[2]);
    if((st2 === 'absent' || st2 === 'excused') && c[sid] && days[d2s_(r[1])]) c[sid].days_absent++;
  });
  return c;
}
function boot_(){
  var secs = rows_('sections').filter(function(r){ return r[0] !== ''; }).map(function(r){
    return {id:n_(r[0]), grade:String(r[1]), name:String(r[2]), label:String(r[3]), ord:n_(r[4])};
  }).sort(function(a, b){ return a.ord - b.ord; });
  return {ok:true, sections:secs, students:students_(), days:Object.keys(schoolDays_()), settings:settings_(), counts:counts_()};
}
function attObj_(r){
  return {student_id:n_(r[0]), day:d2s_(r[1]), status:String(r[2] || 'present'), late_at:t2s_(r[3]),
    uniform_violation:b_(r[4]), leave_at:t2s_(r[5]), leave_reason:r[6] === '' ? null : String(r[6])};
}
function day_(d){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d)) return {ok:false, error:'تاريخ غير صالح'};
  var att = rows_('att').filter(function(r){ return d2s_(r[1]) === d; }).map(attObj_);
  var marks = rows_('marks').filter(function(r){ return d2s_(r[1]) === d; }).map(function(r){ return n_(r[0]); });
  var nt = rows_('notify').filter(function(r){ return d2s_(r[1]) === d; }).map(function(r){ return n_(r[0]) + '|' + String(r[2]); });
  return {ok:true, day:d, att:att, marks:marks, notified:nt, counts:counts_()};
}
function history_(sid){
  var h = rows_('att').filter(function(r){ return n_(r[0]) === sid && (r[2] === 'absent' || r[2] === 'excused'); })
    .map(function(r){ return {day:d2s_(r[1]), status:String(r[2])}; }).sort(function(a, b){ return a.day < b.day ? 1 : -1; });
  return {ok:true, history:h};
}
function disability_(sid, v){
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var s = sh_('students'), r = rows_('students');
    for(var i = 0; i < r.length; i++) if(n_(r[i][0]) === sid){ s.getRange(i + 2, 5).setValue(v); var o = {}; o[sid] = 1; return {ok:true, counts:counts_(o)}; }
    return {ok:false, error:'الطالب غير موجود'};
  } finally { lock.releaseLock(); }
}

function emptyAtt_(sid, d){ return {student_id:sid, day:d, status:'present', late_at:null, uniform_violation:false, leave_at:null, leave_reason:null, by_status:'', by_late:'', by_uniform:'', by_leave:'', updated_at:''}; }
function isEmpty_(a){ return a.status === 'present' && !a.late_at && !a.uniform_violation && !a.leave_at; }
function attRow_(a){ return [a.student_id, a.day, a.status, a.late_at || '', !!a.uniform_violation, a.leave_at || '', a.leave_reason || '', a.by_status || '', a.by_late || '', a.by_uniform || '', a.by_leave || '', a.updated_at || '']; }
function okTime_(t){ return t === null || /^\d{2}:\d{2}$/.test(String(t)); }

function ops_(u, list){
  var lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    var valid = {}; students_().forEach(function(s){ valid[s.id] = 1; });
    var sA = sh_('att'), raw = rows_('att'), idx = {}, state = {}, touched = {}, errors = [], done = 0, stamp = now_();
    raw.forEach(function(r, i){ if(r[0] === '') return; var a = attObj_(r); a.by_status = r[7]; a.by_late = r[8]; a.by_uniform = r[9]; a.by_leave = r[10]; a.updated_at = r[11]; idx[a.student_id + '|' + a.day] = i + 2; state[a.student_id + '|' + a.day] = a; });
    var markAdd = [], markDel = [], notes = [];
    list.forEach(function(op, k){
      try {
        var d = String(op.day || '');
        if(!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error('تاريخ غير صالح');
        if(op.k === 'upsert' || op.k === 'del'){
          var sid = n_(op.sid); if(!valid[sid]) throw new Error('طالب غير موجود');
          var key = sid + '|' + d, a = state[key] || emptyAtt_(sid, d);
          if(op.k === 'del'){ a = emptyAtt_(sid, d); }
          else {
            var f = op.f || {};
            if(f.status !== undefined){ if(!STATUS[f.status]) throw new Error('حالة غير صالحة'); a.status = f.status; a.by_status = u.name; }
            if(f.late_at !== undefined){ if(!okTime_(f.late_at)) throw new Error('وقت غير صالح'); a.late_at = f.late_at; a.by_late = u.name; }
            if(f.uniform_violation !== undefined){ a.uniform_violation = !!f.uniform_violation; a.by_uniform = u.name; }
            if(f.leave_at !== undefined){ if(!okTime_(f.leave_at)) throw new Error('وقت غير صالح'); a.leave_at = f.leave_at; a.by_leave = u.name; }
            if(f.leave_reason !== undefined){ a.leave_reason = f.leave_reason === null ? null : String(f.leave_reason).slice(0, 120); a.by_leave = u.name; }
          }
          a.updated_at = stamp; state[key] = a; touched[key] = 1;
        } else if(op.k === 'mark'){
          var sec = n_(op.sec); (op.on ? markAdd : markDel).push({sec:sec, day:d});
        } else if(op.k === 'notify'){
          if(!KINDS[op.kind] || !valid[n_(op.sid)]) throw new Error('إبلاغ غير صالح');
          notes.push([n_(op.sid), d, op.kind, u.name, stamp]);
        } else throw new Error('عملية غير معروفة');
        done++;
      } catch(e){ errors.push({i:k, error:String(e.message || e)}); }
    });
    // الحضور: تحديث في المكان، ثم إضافة، ثم حذف من الأسفل إلى الأعلى
    var appends = [], dels = [], affected = {};
    Object.keys(touched).forEach(function(key){
      var a = state[key]; affected[a.student_id] = 1;
      if(idx[key]){ if(isEmpty_(a)) dels.push(idx[key]); else sA.getRange(idx[key], 1, 1, HEAD.att.length).setValues([attRow_(a)]); }
      else if(!isEmpty_(a)) appends.push(attRow_(a));
    });
    if(appends.length) sA.getRange(sA.getLastRow() + 1, 1, appends.length, HEAD.att.length).setValues(appends);
    dels.sort(function(x, y){ return y - x; }).forEach(function(r){ sA.deleteRow(r); });
    // تثبيت الشعب
    if(markAdd.length || markDel.length){
      var sM = sh_('marks'), mr = rows_('marks'), have = {};
      mr.forEach(function(r, i){ have[n_(r[0]) + '|' + d2s_(r[1])] = i + 2; });
      var mAdd = [], mDel = [];
      markAdd.forEach(function(m){ var key = m.sec + '|' + m.day; if(!have[key]){ mAdd.push([m.sec, m.day, u.name, stamp]); have[key] = -1; } });
      markDel.forEach(function(m){ var r = have[m.sec + '|' + m.day]; if(r > 0) mDel.push(r); });
      if(mAdd.length) sM.getRange(sM.getLastRow() + 1, 1, mAdd.length, 4).setValues(mAdd);
      mDel.sort(function(x, y){ return y - x; }).forEach(function(r){ sM.deleteRow(r); });
    }
    if(notes.length){ var sN = sh_('notify'); sN.getRange(sN.getLastRow() + 1, 1, notes.length, 5).setValues(notes); }
    SpreadsheetApp.flush();
    return {ok:true, done:done, errors:errors, counts:counts_(affected)};
  } finally { lock.releaseLock(); }
}

/** شغّل هذه الدالة مرة واحدة من المحرّر (Run) بعد اللصق: تفحص الأوراق وتضبط تنسيق الأعمدة وتطلب الصلاحيات. */
function setup(){
  var s = ss_();
  s.setSpreadsheetTimeZone('Asia/Amman');
  Object.keys(SH).forEach(function(k){
    var sheet = s.getSheetByName(SH[k]);
    if(!sheet){ sheet = s.insertSheet(SH[k]); sheet.getRange(1, 1, 1, HEAD[k].length).setValues([HEAD[k]]); }
    sheet.setFrozenRows(1);
    (TEXT_COLS[k] || []).forEach(function(c){ sheet.getRange(1, c, sheet.getMaxRows(), 1).setNumberFormat('@'); });
  });
  var msg = 'الطلاب: ' + students_().length + ' · الشعب: ' + rows_('sections').length + ' · أيام الدوام: ' + Object.keys(schoolDays_()).length +
            ' · المستخدمون الفعّالون: ' + rows_('users').filter(function(r){ return b_(r[2]) && String(r[1]).length >= 8; }).length;
  Logger.log(msg);
  return msg;
}
