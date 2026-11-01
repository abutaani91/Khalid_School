// بيانات وهمية للتجربة فقط. لا أسماء حقيقية في هذا الملف.
(function(){
var GR=['الرابع','الخامس','السادس','السابع','الثامن','التاسع','العاشر','الحادي عشر','الثاني عشر'];
var secs=[],id=0;
GR.forEach(function(g){var ns=g==='الثاني عشر'?['أكاديمي صحي','BTEC الأعمال']:['أ','ب'];
  ns.forEach(function(n){id++;secs.push({id:id,grade:g,name:n,label:n.length===1?g+' '+n:g+' — '+n})})});
var st=[],sid=0;
secs.forEach(function(s){for(var i=1;i<=10;i++){sid++;st.push({id:sid,name:'طالب تجريبي '+sid,section_id:s.id,seat:i,disability:sid%37===0,active:true})}});
var days=[];var d=new Date(2026,7,23),end=new Date(2027,5,20);
var hol=['2026-08-25','2027-03-09','2027-03-10','2027-03-11','2027-03-12','2027-05-15','2027-05-16','2027-05-17','2027-05-18','2027-05-19','2027-05-25','2027-06-06'];
function iso(x){return x.getFullYear()+'-'+('0'+(x.getMonth()+1)).slice(-2)+'-'+('0'+x.getDate()).slice(-2)}
while(d<=end){var w=d.getDay(),s=iso(d);
  var ex=(s>='2026-12-15'&&s<='2027-01-04')||(s>='2027-05-30'&&s<='2027-06-20');
  if((w<=4||(w===6&&ex))&&hol.indexOf(s)<0&&!(s>='2027-01-05'&&s<='2027-01-23'))days.push(s);
  d.setDate(d.getDate()+1)}
window.KB_DEMO={sections:secs,students:st,days:days,
 settings:{year_days:199,absence_rate:0.10,absence_rate_disability:0.30,warn_levels:[0.5,0.75],school:'مدرسة تجريبية',year:'2026 / 2027',
  leave_reasons:['مراجعة طبيب','ظرف عائلي','استدعاء ولي الأمر','مرض','أخرى']}};
})();
