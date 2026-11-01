'use strict';
(function(){
var KB=window.KB,S=KB.S;
var DN=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
var KINDS=[['absent','غياب'],['late','تأخر'],['leave','مغادرة'],['uniform','زي']];
var V={day:KB.iso(new Date()),tab:'absent'},bySec={},raf=0;
function $(s){return document.querySelector(s)}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function toast(m){var t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(toast.h);toast.h=setTimeout(function(){t.style.display='none'},3200)}
function parseISO(s){var a=s.split('-');return new Date(+a[0],+a[1]-1,+a[2])}
function shortDay(s){var d=parseISO(s);return DN[d.getDay()]+' '+d.getDate()+'/'+(d.getMonth()+1)}
function longDay(s){var d=parseISO(s);return DN[d.getDay()]+' '+d.getDate()+'/'+(d.getMonth()+1)+'/'+d.getFullYear()}
function addDays(s,n){var d=parseISO(s);d.setDate(d.getDate()+n);return KB.iso(d)}
function route(){var h=location.hash.replace(/^#\/?/,'').split('/');return{name:h[0]||'home',a:h[1]}}
function buildIdx(){bySec={};S.students.forEach(function(s){(bySec[s.section_id]=bySec[s.section_id]||[]).push(s)});
  Object.keys(bySec).forEach(function(k){bySec[k].sort(function(a,b){return(a.seat||9999)-(b.seat||9999)||a.id-b.id})})}
function secOf(id){return S.sections.filter(function(x){return x.id===id})[0]}
function isAbs(a){return a.status==='absent'||a.status==='excused'}

/* ---------- مكوّنات ---------- */
function syncChip(){var p=KB.pending();
  if(KB.DEMO)return'<span class="chip warn" id="sync">تجريبي'+(p?' · '+p:'')+'</span>';
  if(!navigator.onLine)return'<span class="chip bad" id="sync">غير متصل'+(p?' · '+p+' بانتظار':'')+'</span>';
  if(p)return'<span class="chip warn" id="sync">'+p+' بانتظار الإرسال</span>';
  return'<span class="chip ok" id="sync">متصل</span>'}
function header(title,back){
  var h='<div class="bar"><div class="r1"><div class="row">'+(back?'<button data-act="back" aria-label="رجوع">› رجوع</button>':'')+'<h1>'+esc(title)+'</h1></div><div class="row">'+syncChip()+'<button data-act="settings" aria-label="الإعدادات">⚙</button></div></div>';
  h+='<div class="r2"><button data-act="prev" class="ghost" aria-label="اليوم السابق">›</button><input type="date" id="dt" value="'+V.day+'" aria-label="التاريخ"><button data-act="next" class="ghost" aria-label="اليوم التالي">‹</button><button data-act="today" class="ghost">اليوم</button></div>';
  h+='<div class="muted" style="margin-top:4px">'+longDay(V.day)+'</div></div>';
  if(S.stale)h+='<div class="notice">غير متصل بالخادم: تعرض الشاشة آخر ما حُفظ على هذا الجهاز، وكل ما ترصده يُحفظ ويُرسل تلقائياً عند عودة الاتصال.</div>';
  if(!KB.isSchoolDay(V.day))h+='<div class="notice">هذا اليوم ليس من أيام الدوام الرسمية في التقويم، والغياب فيه لا يُحتسب ضمن الحد السنوي.</div>';
  return h}
function cchip(st){var c=S.counts[st.id];if(!c||!c.days_absent)return'';var mx=c.max_days||KB.maxFor(st),d=c.days_absent,lv=S.settings.warn_levels||[.5,.75];
  var cls=d>mx?'bad':(d>=mx*lv[1]?'warn':(d>=mx*lv[0]?'yel':'mut'));
  return'<span class="chip '+cls+'" title="أيام الغياب إلى الحد السنوي">'+d+' من '+mx+(d>mx?' · تجاوز':'')+'</span>'}
function dayStats(list){var n={a:0,l:0,u:0,v:0};list.forEach(function(s){var a=S.att[s.id];if(!a)return;if(isAbs(a))n.a++;if(a.late_at)n.l++;if(a.uniform_violation)n.u++;if(a.leave_at)n.v++});return n}

/* ---------- الشاشات ---------- */
function home(){
  var all=dayStats(S.students),h=header('متابعة الدوام',false);
  h+='<div class="tiles"><div class="tile"><b>'+all.a+'</b><span>غائب</span></div><div class="tile"><b>'+all.l+'</b><span>متأخر</span></div><div class="tile"><b>'+all.v+'</b><span>مغادرة</span></div><div class="tile"><b>'+all.u+'</b><span>زي</span></div></div>';
  h+='<div class="row" style="margin-bottom:10px"><button class="pri grow" data-act="list">قائمة الإبلاغ والتواصل</button></div>';
  var g='';S.sections.forEach(function(s){var L=bySec[s.id]||[],st=dayStats(L),mk=!!S.marks[s.id];
    if(s.grade!==g){g=s.grade;h+='<h2>الصف '+esc(g)+'</h2>'}
    h+='<button class="sec" data-act="sec" data-id="'+s.id+'"><span><span class="nm">'+esc(s.label)+'</span> <span class="muted">'+L.length+' طالباً</span></span><span class="meta">'+
      (st.a?'<span class="chip bad">'+st.a+' غائب</span>':'')+(st.l?'<span class="chip yel">'+st.l+' متأخر</span>':'')+(mk?'<span class="chip ok">مثبّتة ✓</span>':'<span class="chip mut">لم تُثبَّت</span>')+'</span></button>'});
  return h}
function row(st){var a=KB.getAtt(st.id),ab=isAbs(a),cls='st'+(a.status==='absent'?' abs':a.status==='excused'?' exc':'');
  return'<div class="'+cls+'" data-sid="'+st.id+'"><div class="top"><span class="seat">'+(st.seat||'')+'</span><button class="nm" data-act="file">'+esc(st.name)+'</button>'+cchip(st)+'</div><div class="act">'+
   '<button class="a'+(ab?' on':'')+(a.status==='excused'?' x':'')+'" data-act="abs" aria-pressed="'+ab+'">'+(a.status==='excused'?'غياب بعذر':'غائب')+'</button>'+
   '<button class="l'+(a.late_at?' on':'')+'" data-act="late"'+(ab?' disabled':'')+'>'+(a.late_at?'متأخر '+esc(a.late_at):'متأخر')+'</button>'+
   '<button class="u'+(a.uniform_violation?' on':'')+'" data-act="uni" aria-pressed="'+!!a.uniform_violation+'">'+(a.uniform_violation?'زي ✓':'زي')+'</button>'+
   '<button class="v'+(a.leave_at?' on':'')+'" data-act="leave"'+(ab?' disabled':'')+'>'+(a.leave_at?'غادر '+esc(a.leave_at):'مغادرة')+'</button></div></div>'}
function section(id){var s=secOf(+id);if(!s)return'<p>الشعبة غير موجودة.</p>';var L=bySec[s.id]||[],st=dayStats(L),mk=!!S.marks[s.id];
  var h=header(s.label,true);
  h+='<div class="row" style="margin-bottom:8px"><span class="chip bad">'+st.a+' غائب</span><span class="chip yel">'+st.l+' متأخر</span><span class="chip">'+L.length+' طالباً</span><span class="grow"></span><button data-act="mark" class="'+(mk?'':'pri')+'">'+(mk?'مثبّتة ✓ (إلغاء)':'تثبيت الشعبة')+'</button></div>';
  L.forEach(function(x){h+=row(x)});return h}
function list(kind){kind=kind||V.tab;var h=header('قائمة الإبلاغ',true);
  h+='<div class="tabs">'+KINDS.map(function(k){return'<button data-act="tab" data-k="'+k[0]+'" class="'+(kind===k[0]?'on':'')+'">'+k[1]+'</button>'}).join('')+'</div>';
  var pick=S.students.filter(function(s){var a=S.att[s.id];if(!a)return false;return kind==='absent'?isAbs(a):kind==='late'?!!a.late_at:kind==='leave'?!!a.leave_at:!!a.uniform_violation});
  pick.sort(function(a,b){return secOrd(a)-secOrd(b)||(a.seat||0)-(b.seat||0)});
  h+='<div class="muted" style="margin-bottom:8px">'+pick.length+' طالباً · أرقام أولياء الأمور محمّلة على هذا الجهاز: '+KB.Phones.count()+'</div><div class="card" style="padding:4px 12px">';
  if(!pick.length)h+='<p class="muted">لا شيء مرصود في هذا اليوم.</p>';
  pick.forEach(function(s){var a=S.att[s.id],sc=secOf(s.section_id),det=kind==='absent'?(a.status==='excused'?'بعذر':'بلا عذر'):kind==='late'?'وصل '+a.late_at:kind==='leave'?'غادر '+a.leave_at+(a.leave_reason?' · '+a.leave_reason:''):'';
    var sent=S.notified[s.id+'|'+kind],msg=KB.Tpl.fill(kind,{'الاسم':s.name,'الصف':sc?sc.label:'','التاريخ':longDay(V.day),'الوقت':kind==='late'?a.late_at:a.leave_at||'','السبب':a.leave_reason||'غير مذكور'});
    var url=KB.Phones.wa(s.id,msg);
    h+='<div class="li"><div class="t"><div>'+esc(s.name)+'</div><div class="s">'+esc(sc?sc.label:'')+(det?' · '+esc(det):'')+'</div></div>'+
      (url?'<a class="btn'+(sent?' sent':'')+'" data-act="wa" data-sid="'+s.id+'" data-k="'+kind+'" href="'+url+'" target="_blank" rel="noopener">'+(sent?'أُرسل ✓':'واتساب')+'</a>':'<span class="chip mut">لا رقم</span>')+'</div>'});
  return h+'</div>'}
function secOrd(s){var c=secOf(s.section_id);return c?c.ord||c.id:0}
function settings(){var h=header('الإعدادات',true),u=KB.user();
  h+='<div class="card"><b>'+esc(u?u.name:'')+'</b><div class="muted">'+(KB.DEMO?'وضع تجريبي: بيانات وهمية محفوظة على هذا الجهاز فقط':'متصل بجدول Google الخاص بالمدرسة')+'</div>'+
   '<div class="row" style="margin-top:8px"><button data-act="flush">إرسال المعلّق ('+KB.pending()+')</button>'+(KB.DEMO?'<button data-act="resetdemo">تصفير بيانات التجربة</button>':'<button data-act="logout">تسجيل الخروج</button>')+'</div></div>';
  h+='<div class="card"><b>أرقام أولياء الأمور</b><p class="muted">تُحفظ على هذا الجهاز فقط ولا تُرسل إلى أي خادم. المحمّل الآن: <b>'+KB.Phones.count()+'</b></p>'+
   '<input type="file" id="phf" accept=".json,.csv,.txt" aria-label="ملف الأرقام"><div class="row" style="margin-top:8px"><button data-act="phclear">حذف الأرقام من هذا الجهاز</button></div></div>';
  h+='<div class="card"><b>نصوص رسائل واتساب</b><p class="muted">المتغيّرات: {الاسم} {الصف} {التاريخ} {الوقت} {السبب}</p>';
  KINDS.forEach(function(k){h+='<label class="muted" for="tp-'+k[0]+'">'+k[1]+'</label><textarea id="tp-'+k[0]+'" rows="5" data-k="'+k[0]+'">'+esc(KB.Tpl.get(k[0]))+'</textarea>'});
  h+='<div class="row" style="margin-top:8px"><button class="pri" data-act="tplsave">حفظ النصوص</button><button data-act="tplreset">استرجاع الأصلية</button></div></div>';
  return h+'<p class="muted">الإصدار 1.0 · ' +(KB.DEMO?'تجريبي':'')+'</p>'}
function login(msg){$('#app').innerHTML='<div class="card" style="margin-top:40px"><h1>متابعة الدوام والانضباط</h1><p class="muted">اكتب رمز الدخول الذي أعطاك إياه مساعد المدير.</p>'+
  (msg?'<div class="notice">'+esc(msg)+'</div>':'')+'<label class="muted" for="cd">رمز الدخول</label><input id="cd" type="password" autocomplete="current-password" dir="ltr" style="letter-spacing:2px"><div class="row" style="margin-top:12px"><button class="pri grow" id="go">دخول</button></div></div>';
  function go(){var b=$('#go'),v=$('#cd').value.trim();if(v.length<8){login('الرمز قصير، تأكد منه.');return}b.disabled=true;b.textContent='جارٍ التحقق…';
    KB.login(v).then(start,function(e){login(e&&e.auth?'الرمز غير صحيح أو موقوف.':(e&&e.message)||'تعذّر الدخول')})}
  $('#go').onclick=go;$('#cd').onkeydown=function(e){if(e.key==='Enter')go()};$('#cd').focus()}
/* ---------- النوافذ ---------- */
function sheet(html){var s=$('#sheet');s.innerHTML='<div class="box" role="dialog" aria-modal="true">'+html+'</div>';s.hidden=false}
function closeSheet(){$('#sheet').hidden=true;$('#sheet').innerHTML=''}
function lateSheet(sid){var a=KB.getAtt(sid);sheet('<h2>وقت التأخر</h2><input type="time" id="tv" value="'+(a.late_at||KB.tm())+'"><div class="row" style="margin-top:12px"><button class="pri grow" data-sact="late-ok" data-sid="'+sid+'">حفظ</button>'+(a.late_at?'<button data-sact="late-clr" data-sid="'+sid+'">إزالة</button>':'')+'<button data-sact="close">إلغاء</button></div>')}
function leaveSheet(sid){var a=KB.getAtt(sid),rs=S.settings.leave_reasons||['أخرى'];
  sheet('<h2>مغادرة الطالب</h2><label class="muted" for="tv">الوقت</label><input type="time" id="tv" value="'+(a.leave_at||KB.tm())+'"><label class="muted" for="rs">السبب</label><select id="rs">'+rs.map(function(r){return'<option'+(a.leave_reason===r?' selected':'')+'>'+esc(r)+'</option>'}).join('')+'</select><div class="row" style="margin-top:12px"><button class="pri grow" data-sact="leave-ok" data-sid="'+sid+'">حفظ</button>'+(a.leave_at?'<button data-sact="leave-clr" data-sid="'+sid+'">إزالة</button>':'')+'<button data-sact="close">إلغاء</button></div>')}
function fileSheet(sid){var st=S.byId[sid],sc=secOf(st.section_id),c=S.counts[sid]||{days_absent:0,max_days:KB.maxFor(st)},mx=c.max_days,d=c.days_absent,pc=Math.min(100,Math.round(d/mx*100));
  var cls=d>mx?'bad':pc>=75?'warn':'';
  var url=KB.Phones.wa(sid,'');
  sheet('<h2 style="margin-top:0">'+esc(st.name)+'</h2><div class="muted">'+esc(sc?sc.label:'')+'</div><div style="margin-top:10px"><b>أيام الغياب: '+d+' من '+mx+'</b> <span class="muted">(الحد السنوي '+(st.disability?'30%':'10%')+')</span><div class="prog"><i class="'+cls+'" style="width:'+pc+'%"></i></div>'+(d>mx?'<div class="chip bad">تجاوز الحد المسموح</div>':'')+'</div>'+
   '<label class="row" style="margin:10px 0"><input type="checkbox" id="dis" style="width:auto;min-height:0"'+(st.disability?' checked':'')+' data-sid="'+sid+'"> طالب من ذوي الإعاقة (حد الغياب 30%)</label>'+
   (url?'<a class="btn" href="'+url+'" target="_blank" rel="noopener">محادثة واتساب مع ولي الأمر</a>':'<span class="chip mut">لا رقم محمّل على هذا الجهاز</span>')+
   '<h2>سجل الغياب</h2><div id="hist" class="muted">جارٍ التحميل…</div><div class="row" style="margin-top:12px"><button class="grow" data-sact="close">إغلاق</button></div>');
  KB.history(sid).then(function(r){var el=$('#hist');if(!el)return;el.innerHTML=r.length?r.map(function(x){return'<div class="li"><span>'+shortDay(x.day)+'</span><span class="chip '+(x.status==='excused'?'warn':'bad')+'">'+(x.status==='excused'?'بعذر':'بلا عذر')+'</span></div>'}).join(''):'لا غياب مسجّل.'},function(){var el=$('#hist');if(el)el.textContent='تعذّر تحميل السجل.'})}

/* ---------- التوجيه والرسم ---------- */
function render(){var r=route(),y=window.scrollY,h;
  if(!S.students.length&&!KB.DEMO){return}
  if(r.name==='sec')h=section(r.a);else if(r.name==='list')h=list(r.a||V.tab);else if(r.name==='settings')h=settings();else h=home();
  $('#app').innerHTML=h;window.scrollTo(0,y)}
function later(){if(raf)return;raf=requestAnimationFrame(function(){raf=0;if(route().name==='settings'||!$('#sheet').hidden&&$('#tv'))return;render()})}
function go(h){if(location.hash!==h)location.hash=h;else render()}
function changeDay(d){V.day=d;KB.loadDay(d).then(render,function(){toast('تعذّر تحميل اليوم')})}
document.addEventListener('click',function(e){
  var sa=e.target.closest('[data-sact]');if(sa){var k=sa.dataset.sact,sid=+sa.dataset.sid;
    if(k==='close')closeSheet();
    else if(k==='late-ok'){KB.Ops.setLate(sid,$('#tv').value||KB.tm());closeSheet()}
    else if(k==='late-clr'){KB.Ops.setLate(sid,null);closeSheet()}
    else if(k==='leave-ok'){KB.Ops.setLeave(sid,$('#tv').value||KB.tm(),$('#rs').value);closeSheet()}
    else if(k==='leave-clr'){KB.Ops.setLeave(sid,null,null);closeSheet()}
    return}
  if(e.target.id==='sheet'){closeSheet();return}
  var b=e.target.closest('[data-act]');if(!b)return;var act=b.dataset.act,row=b.closest('[data-sid]'),sid=row?+row.dataset.sid:+b.dataset.sid;
  switch(act){
   case'back':history.length>1&&location.hash!==''?history.back():go('#/home');break;
   case'settings':go('#/settings');break;
   case'prev':changeDay(addDays(V.day,-1));break;
   case'next':changeDay(addDays(V.day,1));break;
   case'today':changeDay(KB.iso(new Date()));break;
   case'sec':go('#/sec/'+b.dataset.id);break;
   case'list':go('#/list/'+V.tab);break;
   case'tab':V.tab=b.dataset.k;go('#/list/'+V.tab);break;
   case'abs':var a=KB.getAtt(sid);KB.Ops.setStatus(sid,a.status==='present'?'absent':a.status==='absent'?'excused':'present');break;
   case'uni':KB.Ops.setUniform(sid,!KB.getAtt(sid).uniform_violation);break;
   case'late':var al=KB.getAtt(sid);if(al.late_at)lateSheet(sid);else KB.Ops.setLate(sid,KB.tm());break;
   case'leave':leaveSheet(sid);break;
   case'file':fileSheet(sid);break;
   case'mark':var m=route();KB.Ops.toggleMark(+m.a);break;
   case'wa':KB.Ops.notify(sid,b.dataset.k);break;
   case'flush':KB.flush();toast('جارٍ الإرسال…');break;
   case'logout':KB.logout().then(function(){location.hash='';location.reload()});break;
   case'resetdemo':if(KB.DEMO){Object.keys(localStorage).forEach(function(k){if(k.indexOf('kbd-')===0||k==='kb-queue')localStorage.removeItem(k)});location.reload()}break;
   case'phclear':KB.Phones.clear();render();toast('حُذفت الأرقام من هذا الجهاز');break;
   case'tplsave':document.querySelectorAll('textarea[data-k]').forEach(function(t){KB.Tpl.set(t.dataset.k,t.value)});toast('حُفظت النصوص');break;
   case'tplreset':KB.Tpl.reset();render();break}
});
document.addEventListener('change',function(e){
  if(e.target.id==='dt'&&e.target.value){changeDay(e.target.value)}
  else if(e.target.id==='phf'){var f=e.target.files[0];if(!f)return;var r=new FileReader();r.onload=function(){var n=KB.Phones.import(r.result);render();toast('استُوردت '+n+' رقماً إلى هذا الجهاز')};r.readAsText(f)}
  else if(e.target.id==='dis'){var sid=+e.target.dataset.sid,v=e.target.checked;KB.setDisability(sid,v).then(function(){toast('حُدّث الحد');render()},function(){e.target.checked=!v;toast('تعذّر الحفظ')})}
});
window.addEventListener('hashchange',function(){render();window.scrollTo(0,0)});
KB.on(function(t,m){if(t==='error'){toast(m);return}if(t==='auth'){KB.logout().then(function(){login('انتهت صلاحية رمز الدخول، أدخله من جديد.')});return}if(t==='sync'){if(!S.stale&&$('.notice')&&$('.notice').textContent.indexOf('غير متصل')===0)later();var c=$('#sync');if(c){var d=document.createElement('div');d.innerHTML=syncChip();c.replaceWith(d.firstChild)}return}later()});
document.addEventListener('visibilitychange',function(){if(!document.hidden&&S.day){KB.loadDay(V.day).then(function(){render()},function(){});KB.flush()}});

function start(){return KB.load().then(function(){buildIdx();return KB.loadDay(V.day)}).then(function(){KB.startPolling();render()})
  .catch(function(e){$('#app').innerHTML='<div class="card" style="margin-top:30px"><b>تعذّر تحميل البيانات</b><p class="muted">'+esc(e&&e.message||'')+'</p><button class="pri" onclick="location.reload()">إعادة المحاولة</button></div>'})}
KB.init().then(function(u){if(!KB.DEMO&&!u){login();return}return start()},function(e){login(e&&e.message)});
if('serviceWorker' in navigator&&/^https?:/.test(location.protocol)){navigator.serviceWorker.register('sw.js').catch(function(){})}
window.__kb={V:V,render:render};
})();
