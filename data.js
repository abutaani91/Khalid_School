'use strict';
/* طبقة البيانات: وضع تجريبي محلي، أو Supabase. الواجهة لا تعرف الفرق. */
(function(){
var CFG=window.KB_CONFIG||{};
var DEMO=!CFG.gas;
function lsGet(k){try{var x=localStorage.getItem(k);return x?JSON.parse(x):null}catch(e){return null}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}}
var S={sections:[],students:[],byId:{},schoolDays:{},settings:{},counts:{},att:{},marks:{},notified:{},day:null};
var user=null,sb=null,listeners=[],queue=lsGet('kb-queue')||[],flushing=false,lastOk=true,timers={};
var DEMO_PREFIX='kbd-';
function emit(t){listeners.forEach(function(f){try{f(t)}catch(e){console.error(e)}})}
function on(f){listeners.push(f)}
function tm(d){d=d||new Date();return('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2)}
function hm(t){return t?String(t).slice(0,5):null}
function iso(d){return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2)}
function emptyRow(sid,day){return{student_id:sid,day:day,status:'present',late_at:null,uniform_violation:false,leave_at:null,leave_reason:null}}
function isEmpty(r){return r.status==='present'&&!r.late_at&&!r.uniform_violation&&!r.leave_at}
function norm(r){return{student_id:r.student_id,day:r.day,status:r.status,late_at:hm(r.late_at),uniform_violation:!!r.uniform_violation,leave_at:hm(r.leave_at),leave_reason:r.leave_reason||null}}
function maxFor(st){var s=S.settings;var rate=st.disability?s.absence_rate_disability:s.absence_rate;return Math.floor(Number(s.year_days)*Number(rate)+1e-9)}
function isSchoolDay(day){return !!S.schoolDays[day]}

/* ---------------- الوضع التجريبي ---------------- */
function demoRows(){return lsGet(DEMO_PREFIX+'att')||[]}
function demoCounts(){var c={};S.students.forEach(function(s){c[s.id]={days_absent:0,max_days:maxFor(s)}});
  demoRows().forEach(function(r){if((r.status==='absent'||r.status==='excused')&&S.schoolDays[r.day]&&c[r.student_id])c[r.student_id].days_absent++});S.counts=c}
var demo={
  init:function(){user={id:'demo',name:'مستخدم تجريبي'};return Promise.resolve(user)},
  load:function(){var D=window.KB_DEMO;S.sections=D.sections;S.students=lsGet(DEMO_PREFIX+'st')||D.students;S.settings=D.settings;S.schoolDays={};D.days.forEach(function(d){S.schoolDays[d]=1});
    if(!lsGet(DEMO_PREFIX+'att')){var seed=[],ds=D.days.slice(0,40);
      for(var i=0;i<14;i++)seed.push({student_id:3,day:ds[i],status:i%3?'absent':'excused'});
      for(var j=0;j<10;j++)seed.push({student_id:5,day:ds[j+3],status:'absent'});
      for(var k=0;k<20;k++)seed.push({student_id:7,day:ds[k],status:'absent'});
      lsSet(DEMO_PREFIX+'att',seed)}
    S.byId={};S.students.forEach(function(s){S.byId[s.id]=s});demoCounts();return Promise.resolve()},
  loadDay:function(day){S.day=day;S.att={};demoRows().forEach(function(r){if(r.day===day)S.att[r.student_id]=norm(r)});
    var m=lsGet(DEMO_PREFIX+'marks')||[];S.marks={};m.forEach(function(x){if(x.day===day)S.marks[x.section_id]=x});
    var n=lsGet(DEMO_PREFIX+'notif')||[];S.notified={};n.forEach(function(x){if(x.day===day)S.notified[x.student_id+'|'+x.kind]=1});return Promise.resolve()},
  upsert:function(sid,day,fields){var rows=demoRows(),r=rows.filter(function(x){return x.student_id===sid&&x.day===day})[0];
    if(!r){r=emptyRow(sid,day);rows.push(r)}Object.keys(fields).forEach(function(k){r[k]=fields[k]});lsSet(DEMO_PREFIX+'att',rows);return Promise.resolve()},
  del:function(sid,day){lsSet(DEMO_PREFIX+'att',demoRows().filter(function(x){return!(x.student_id===sid&&x.day===day)}));return Promise.resolve()},
  mark:function(sec,day,onn){var m=(lsGet(DEMO_PREFIX+'marks')||[]).filter(function(x){return!(x.section_id===sec&&x.day===day)});if(onn)m.push({section_id:sec,day:day});lsSet(DEMO_PREFIX+'marks',m);return Promise.resolve()},
  notify:function(sid,day,kind){var n=lsGet(DEMO_PREFIX+'notif')||[];n.push({student_id:sid,day:day,kind:kind});lsSet(DEMO_PREFIX+'notif',n);return Promise.resolve()},
  history:function(sid){return Promise.resolve(demoRows().filter(function(r){return r.student_id===sid&&(r.status==='absent'||r.status==='excused')}).sort(function(a,b){return a.day<b.day?1:-1}).map(function(r){return{day:r.day,status:r.status}}))},
  disability:function(sid,v){S.byId[sid].disability=v;lsSet(DEMO_PREFIX+'st',S.students);return Promise.resolve()},
  refreshCounts:function(){demoCounts();emit('counts');return Promise.resolve()},
  login:function(){return Promise.resolve()},logout:function(){return Promise.resolve()}
};

/* ---------------- خادم Google Apps Script ---------------- */
function lsDel(k){try{localStorage.removeItem(k)}catch(e){}}
function call(action,p){var body=JSON.stringify(Object.assign({action:action,code:lsGet('kb-code')},p||{}));
  return fetch(CFG.gas,{method:'POST',body:body,redirect:'follow'}).then(function(r){if(!r.ok)throw netErr('HTTP '+r.status);return r.json()},function(e){throw netErr(e&&e.message)})
    .then(function(j){if(!j||!j.ok){var e=new Error((j&&j.error)||'خطأ في الخادم');e.server=true;e.auth=j&&j.code==='auth';throw e}return j})}
function netErr(m){var e=new Error('تعذّر الاتصال بالخادم'+(m?' ('+m+')':''));e.net=true;return e}
function pendingSids(){var m={};queue.forEach(function(q){if(q.sid)m[q.sid]=1});return m}
function mergeCounts(c,full){if(!c)return;var pend=pendingSids();if(full){var n={};Object.keys(c).forEach(function(k){n[k]=pend[k]&&S.counts[k]?S.counts[k]:c[k]});S.counts=n}else Object.keys(c).forEach(function(k){if(!pend[k])S.counts[k]=c[k]})}
function applyBoot(j){S.sections=j.sections;S.students=j.students;S.byId={};S.students.forEach(function(s){S.byId[s.id]=s});
  S.schoolDays={};j.days.forEach(function(d){S.schoolDays[d]=1});S.settings=j.settings||{};S.counts=j.counts||{}}
var remote={
  init:function(){if(!lsGet('kb-code'))return Promise.resolve(null);user=lsGet('kb-user');
    return call('login').then(function(j){user=j.user;lsSet('kb-user',user);return user},function(e){
      if(e.auth){remote.logout();throw new Error('رمز الدخول لم يعد صالحاً، اطلب رمزاً جديداً')}
      if(user&&lsGet('kb-boot'))return user;throw e})},
  login:function(code){lsSet('kb-code',String(code||'').trim());return call('login').then(function(j){user=j.user;lsSet('kb-user',user);return user},function(e){lsDel('kb-code');throw e})},
  logout:function(){['kb-code','kb-user','kb-boot'].forEach(lsDel);user=null;return Promise.resolve()},
  load:function(){return call('boot').then(function(j){lsSet('kb-boot',j);return j},function(e){var c=lsGet('kb-boot');if(c&&!e.auth)return c;throw e}).then(applyBoot)},
  loadDay:function(day){S.day=day;return call('day',{day:day}).then(function(j){if(S.day!==day)return;S.stale=false;lsSet('kb-day',j);
      var pend={};queue.forEach(function(q){if(q.sid)pend[q.sid+'|'+q.day]=1});
      var att={};j.att.forEach(function(r){att[r.student_id]=norm(r)});
      Object.keys(S.att).forEach(function(sid){if(pend[sid+'|'+day])att[sid]=S.att[sid]});
      Object.keys(att).forEach(function(sid){if(pend[sid+'|'+day]&&!S.att[sid])delete att[sid]});
      S.att=att;S.marks={};j.marks.forEach(function(s){S.marks[s]={section_id:s,day:day}});
      queue.forEach(function(q){if(q.k==='mark'&&q.day===day){if(q.on)S.marks[q.sec]={section_id:q.sec,day:day};else delete S.marks[q.sec]}});
      S.notified={};j.notified.forEach(function(k){S.notified[k]=1});mergeCounts(j.counts,true)},function(e){
      if(e&&e.auth)throw e;if(S.day!==day)return;S.stale=true;lastOk=false;
      var c=lsGet('kb-day'),src=c&&c.day===day?c:{att:[],marks:[],notified:[]};
      var keep=S.att;S.att={};src.att.forEach(function(r){S.att[r.student_id]=norm(r)});
      queue.forEach(function(q){if(q.day===day&&q.sid&&keep[q.sid])S.att[q.sid]=keep[q.sid];if(q.k==='del'&&q.day===day)delete S.att[q.sid]});
      S.marks={};src.marks.forEach(function(x){S.marks[x]={section_id:x,day:day}});S.notified={};src.notified.forEach(function(k){S.notified[k]=1});emit('sync')})},
  ops:function(list){return call('ops',{ops:list})},
  history:function(sid){return call('history',{sid:sid}).then(function(j){return j.history})},
  disability:function(sid,v){return call('disability',{sid:sid,v:v}).then(function(j){S.byId[sid].disability=v;mergeCounts(j.counts);emit('counts')})},
  refreshCounts:function(){return S.day?remote.loadDay(S.day).then(function(){emit('counts')}):Promise.resolve()}
};
demo.ops=function(list){list.forEach(function(op){if(op.k==='upsert')demo.upsert(op.sid,op.day,op.f);else if(op.k==='del')demo.del(op.sid,op.day);else if(op.k==='mark')demo.mark(op.sec,op.day,op.on);else demo.notify(op.sid,op.day,op.kind)});return Promise.resolve({ok:true,errors:[]})};
function debounce(k,ms,f){clearTimeout(timers[k]);timers[k]=setTimeout(f,ms)}
var api=DEMO?demo:remote;

/* ---------------- الطابور (عدم الاتصال): كل المعلّق يُرسل في طلب واحد ---------------- */
function saveQ(){lsSet('kb-queue',queue)}
function enqueue(op){queue.push(op);saveQ();emit('sync');debounce('fl',DEMO?0:350,flush)}
function flush(){if(flushing||!queue.length)return;flushing=true;var batch=queue.slice(0,60);
  api.ops(batch).then(function(j){queue.splice(0,batch.length);saveQ();flushing=false;lastOk=true;
      if(j&&j.errors&&j.errors.length)emit('error','لم يُحفظ '+j.errors.length+' إدخال: '+j.errors[0].error);
      if(DEMO)demoCounts();else mergeCounts(j&&j.counts);emit('sync');emit('counts');if(queue.length)flush()},
    function(e){flushing=false;lastOk=false;emit('sync');if(e&&e.auth)emit('auth')})}
window.addEventListener('online',function(){flush()});
setInterval(function(){if(queue.length)flush()},15000);

/* ---------------- العمليات ---------------- */
function getAtt(sid){return S.att[sid]||emptyRow(sid,S.day)}
function bump(sid,wasAbs,nowAbs){if(wasAbs===nowAbs||!isSchoolDay(S.day))return;var c=S.counts[sid]||(S.counts[sid]={days_absent:0,max_days:maxFor(S.byId[sid])});c.days_absent+=nowAbs?1:-1;if(c.days_absent<0)c.days_absent=0}
function apply(sid,patch){
  var day=S.day,cur=getAtt(sid),was=cur.status==='absent'||cur.status==='excused';
  var nxt=Object.assign({},cur,patch);
  var f={};Object.keys(patch).forEach(function(k){f[k]=patch[k]});
  var now=nxt.status==='absent'||nxt.status==='excused';
  if(isEmpty(nxt)){delete S.att[sid];enqueue({k:'del',sid:sid,day:day})}
  else{S.att[sid]=nxt;enqueue({k:'upsert',sid:sid,day:day,f:f})}
  bump(sid,was,now);
  if(DEMO)demoCounts();
  emit('att')}
var Ops={
  setStatus:function(sid,st){var p={status:st};if(st!=='present'){p.late_at=null;p.leave_at=null;p.leave_reason=null}apply(sid,p)},
  setLate:function(sid,t){var p={late_at:t};if(t&&getAtt(sid).status!=='present')p.status='present';apply(sid,p)},
  setUniform:function(sid,v){apply(sid,{uniform_violation:!!v})},
  setLeave:function(sid,t,reason){var p={leave_at:t,leave_reason:t?reason||null:null};if(t&&getAtt(sid).status!=='present')p.status='present';apply(sid,p)},
  toggleMark:function(sec){var on=!S.marks[sec];if(on)S.marks[sec]={section_id:sec,day:S.day};else delete S.marks[sec];enqueue({k:'mark',sec:sec,day:S.day,on:on});emit('att')},
  notify:function(sid,kind){S.notified[sid+'|'+kind]=1;enqueue({k:'notify',sid:sid,day:S.day,kind:kind});emit('att')}
};

/* ---------------- الأرقام: على هذا الجهاز فقط ---------------- */
var Phones={
  map:function(){return lsGet('kb-phones')||{}},
  get:function(id){var p=Phones.map()[id];return p||null},
  count:function(){return Object.keys(Phones.map()).length},
  import:function(text){var m={},n=0;text=String(text).trim();
    try{var j=JSON.parse(text);Object.keys(j).forEach(function(k){m[k]=String(j[k])})}catch(e){
      text.split(/\r?\n/).forEach(function(l){var a=l.split(/[,;\t]/);if(a.length>=2&&/^\d+$/.test(a[0].trim())){m[a[0].trim()]=a[1].trim()}})}
    Object.keys(m).forEach(function(k){var d=String(m[k]).replace(/\D/g,'');if(d.length===9&&d[0]==='7')d='0'+d;if(/^07[789]\d{7}$/.test(d)){m[k]=d;n++}else delete m[k]});
    var cur=Phones.map();Object.keys(m).forEach(function(k){cur[k]=m[k]});lsSet('kb-phones',cur);return n},
  clear:function(){try{localStorage.removeItem('kb-phones')}catch(e){}},
  wa:function(id,text){var p=Phones.get(id);if(!p)return null;return'https://wa.me/962'+p.slice(1)+'?text='+encodeURIComponent(text)}
};
var TPL_DEFAULT={
  absent:'السلام عليكم ورحمة الله وبركاته\nولي أمر الطالب {الاسم} ({الصف})\nنفيدكم بأن ابنكم لم يحضر إلى المدرسة اليوم {التاريخ}. نرجو إفادتنا بسبب الغياب وتزويدنا بالعذر إن وُجد.\nإدارة مدرسة خالد بن الوليد الثانوية للبنين',
  late:'السلام عليكم ورحمة الله وبركاته\nولي أمر الطالب {الاسم} ({الصف})\nنفيدكم بأن ابنكم وصل إلى المدرسة متأخراً اليوم {التاريخ} في تمام الساعة {الوقت}. نأمل منكم المساعدة في الالتزام بموعد الدوام.\nإدارة المدرسة',
  leave:'السلام عليكم ورحمة الله وبركاته\nولي أمر الطالب {الاسم} ({الصف})\nنفيدكم بأن ابنكم غادر المدرسة اليوم {التاريخ} الساعة {الوقت}. السبب المسجّل: {السبب}.\nإدارة المدرسة',
  uniform:'السلام عليكم ورحمة الله وبركاته\nولي أمر الطالب {الاسم} ({الصف})\nنفيدكم بأن ابنكم لم يلتزم بالزي المدرسي اليوم {التاريخ}. نأمل منكم التعاون في التزامه به.\nإدارة المدرسة'};
var Tpl={get:function(k){var t=lsGet('kb-tpl')||{};return t[k]||TPL_DEFAULT[k]},set:function(k,v){var t=lsGet('kb-tpl')||{};t[k]=v;lsSet('kb-tpl',t)},reset:function(){try{localStorage.removeItem('kb-tpl')}catch(e){}},
  fill:function(k,vars){return Tpl.get(k).replace(/\{([^}]+)\}/g,function(m,n){return vars[n]!==undefined?vars[n]:m})}};

window.KB={DEMO:DEMO,S:S,on:on,tm:tm,iso:iso,isSchoolDay:isSchoolDay,getAtt:getAtt,Ops:Ops,Phones:Phones,Tpl:Tpl,
  user:function(){return user},
  init:function(){return api.init()},login:function(e,p){return api.login(e,p)},logout:function(){return api.logout()},
  load:function(){return api.load()},loadDay:function(d){return api.loadDay(d)},history:function(s){return api.history(s)},
  setDisability:function(sid,v){return api.disability(sid,v)},refreshCounts:function(){return api.refreshCounts()},
  pending:function(){return queue.length},online:function(){return navigator.onLine&&lastOk},flush:flush,maxFor:maxFor,
  startPolling:function(){clearInterval(timers.poll);timers.poll=setInterval(function(){if(DEMO||document.hidden||!S.day||queue.length||flushing)return;api.loadDay(S.day).then(function(){emit('att')},function(){lastOk=false;emit('sync')})},30000)},
  whoName:function(){return user&&user.name}};
})();
