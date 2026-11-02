import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const config = window.APP_CONFIG || {};
const url = String(config.supabaseUrl || '').trim();
const key = String(config.publishableKey || '').trim();
const ready = /^https:\/\/[a-z0-9.-]+\.supabase\.co\/?$/.test(url) && key.length > 30;
let db = null;
let busy = false;
let toastTimer = null;
const LABEL = {present:'มาเรียน',absent:'ขาดเรียน',late:'มาสาย',sick:'ลาป่วย',personal:'ลากิจ'};
const STATUS = ['present','absent','late','sick','personal'];
const TITLES = {dashboard:'ภาพรวมระบบ',attendance:'เช็คชื่อรายวัน',students:'จัดการนักเรียน',reports:'รายงานสถิติ',management:'จัดการผู้ใช้และห้องเรียน'};
const state = {
  user:null, profile:null, classes:[], students:[], assignments:[], profiles:[],
  page:'dashboard',date:localDate(new Date()),classId:'',studentClass:'all',
  search:'',daily:[],report:[],reportReady:false,reportLoading:false,
  reportClass:'all',from:localDate(new Date(Date.now()-29*86400000)),to:localDate(new Date())
};
const $ = id => document.getElementById(id);
function esc(v){return String(v == null ? '' : v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function localDate(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function thDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s || ''))return s;const a=s.split('-').map(Number);return new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short',year:'numeric'}).format(new Date(a[0],a[1]-1,a[2]));}
function fmt(n){return Number(n || 0).toLocaleString('th-TH');}
function pct(x,y){return y ? Math.round(x*100/y) : 0;}
function isAdmin(){return state.profile && state.profile.role === 'admin';}
function className(id){const c=state.classes.find(x=>x.id===id);return c ? c.name : '-';}
function selectedClass(){return state.classes.find(c=>c.id===state.classId);}
function getStudent(id){return state.students.find(s=>s.id===id);}
function errorText(err){
  if(!err)return 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
  const code=String(err.code || '');
  if(code==='23505')return 'มีข้อมูลซ้ำ เช่น เลขที่นักเรียนซ้ำในห้องเดียวกัน';
  if(code==='23503')return 'ไม่สามารถลบรายการนี้ได้ เพราะมีข้อมูลอื่นใช้อ้างอิงอยู่';
  if(code==='42501' || code==='PGRST301')return 'คุณไม่มีสิทธิ์ดำเนินการนี้ กรุณาติดต่อผู้ดูแล';
  return err.message || 'ไม่สามารถดำเนินการได้';
}
function toast(s,bad=false){const el=$('toast');el.textContent=s;el.className='toast'+(bad?' bad':'');el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,4200);}
function setBusy(value){busy=value;$('busy').hidden=!value;}
function show(screen){
  ['setupScreen','loginScreen','loadingScreen','appScreen'].forEach(x=>$(x).hidden=(x!==screen));
}
function empty(title,desc){return '<div class="empty"><b>'+esc(title)+'</b>'+esc(desc || '')+'</div>';}
function btn(action,text,kind,attrs){return '<button type="button" class="btn '+(kind || 'secondary')+'" data-action="'+esc(action)+'" '+(attrs || '')+'>'+esc(text)+'</button>';}
function opts(current,all=false){
  let html=all?'<option value="all"'+(current==='all'?' selected':'')+'>ทุกชั้นเรียน</option>':'';
  return html+state.classes.map(c=>'<option value="'+esc(c.id)+'"'+(current===c.id?' selected':'')+'>'+esc(c.name)+'</option>').join('');
}
function field(label,id,type,value,more){
  return '<div class="field"><label for="'+esc(id)+'">'+esc(label)+'</label><input class="control" type="'+type+'" id="'+esc(id)+'" value="'+esc(value)+'" '+(more||'')+'></div>';
}
function metric(title,value,foot){return '<div class="metric"><div class="small muted">'+title+'</div><div class="value">'+fmt(value)+'</div><div class="small muted">'+(foot || '')+'</div></div>';}
async function pages(table,columns,order,filters){
  const size=500;
  let result=[];
  for(let offset=0;offset<200000;offset+=size){
    let q=db.from(table).select(columns).order(order,{ascending:true}).range(offset,offset+size-1);
    if(filters)q=filters(q);
    const {data,error}=await q;
    if(error)throw error;
    result.push(...(data||[]));
    if(!data || data.length<size)break;
  }
  return result;
}
async function signedIn(){
  show('loadingScreen');
  try {
    const {data,error}=await db.auth.getUser();
    if(error || !data.user){show('loginScreen');return;}
    state.user=data.user;
    await reloadAll();
    show('appScreen');
    $('userName').textContent=state.profile.full_name || state.user.email || 'ครู';
    $('userRole').textContent=isAdmin()?'ผู้ดูแลระบบ':'ครูผู้สอน';
    $('managementNav').hidden=!isAdmin();
    render();
  }catch(e){show('loginScreen');$('loginMessage').textContent='ตั้งค่าระบบไม่สมบูรณ์: '+errorText(e);}
}
async function reloadAll(){
  const {data:profile,error}=await db.from('profiles').select('id,full_name,role').eq('id',state.user.id).single();
  if(error)throw error;
  if(!profile)throw new Error('ไม่พบข้อมูลบัญชีครู โปรดรัน schema.sql');
  state.profile=profile;
  const list=await Promise.all([
    pages('school_classes','id,name','name'),
    pages('students','id,class_id,student_no,full_name','id'),
    isAdmin()?pages('profiles','id,full_name,role','id'):Promise.resolve([]),
    isAdmin()?pages('class_teachers','class_id,teacher_id','class_id'):Promise.resolve([])
  ]);
  state.classes=list[0];state.students=list[1];state.profiles=list[2];state.assignments=list[3];
  if(!state.classes.some(c=>c.id===state.classId))state.classId=state.classes[0]?.id || '';
  if(state.studentClass!=='all'&&!state.classes.some(c=>c.id===state.studentClass))state.studentClass='all';
  await loadDaily();
  state.reportReady=false;
}
async function loadDaily(){
  if(!state.user)return;
  state.daily=await pages('attendance','id,student_id,attendance_date,status,note','id',q=>q.eq('attendance_date',state.date));
}
function attendanceFor(studentId){return state.daily.find(a=>a.student_id===studentId);}
function tally(list){
  const out={present:0,absent:0,late:0,sick:0,personal:0,unmarked:0};
  list.forEach(s=>{const record=attendanceFor(s.id);const key=record?.status;if(key && Object.hasOwn(out,key))out[key]++;else out.unmarked++;});
  return out;
}
function render(){
  if(!state.user)return;
  $('pageTitle').textContent=TITLES[state.page];
  document.querySelectorAll('[data-page]').forEach(el=>el.classList.toggle('active',el.dataset.page===state.page));
  $('sidebar').classList.remove('open');
  if(state.page==='dashboard')renderDashboard();
  if(state.page==='attendance')renderAttendance();
  if(state.page==='students')renderStudents();
  if(state.page==='reports')renderReports();
  if(state.page==='management')renderManagement();
}
function renderDashboard(){
  const t=tally(state.students);
  const done=state.students.length-t.unmarked;
  const per=state.classes.map(c=>{
    const students=state.students.filter(s=>s.class_id===c.id);
    const counts=tally(students);
    const marked=students.length-counts.unmarked;
    return '<div class="list-row"><div><b>'+esc(c.name)+'</b><div class="small muted">'+fmt(marked)+' / '+fmt(students.length)+' คน</div></div><div style="width:42%"><div class="bar"><span style="width:'+pct(marked,students.length)+'%"></span></div><div class="small muted" style="text-align:right">'+pct(marked,students.length)+'%</div></div></div>';
  }).join('');
  $('pageContent').innerHTML=
    '<div class="hero"><span class="pill">ระบบเช็คชื่อออนไลน์</span><h2>สวัสดี '+esc(state.profile.full_name || 'คุณครู')+' 👋</h2><p>โรงเรียนบ้านหินลาด · ข้อมูลประจำวันที่ '+esc(thDate(state.date))+'</p></div>'+
    '<div class="metrics">'+metric('นักเรียนในความรับผิดชอบ',state.students.length,'คน')+metric('มาเรียนและมาสาย',t.present+t.late,'คน')+metric('ขาดเรียน',t.absent,'คน')+metric('เช็คชื่อแล้ว',done,'จากทั้งหมด '+fmt(state.students.length))+'</div>'+
    '<div class="two-cols"><section class="panel"><div class="panel-head"><h3>ความคืบหน้าการเช็คชื่อ</h3>'+btn('go-attendance','ไปหน้าเช็คชื่อ','primary sm')+'</div>'+(per || empty('ยังไม่มีชั้นเรียน','ผู้ดูแลระบบต้องสร้างห้องและมอบหมายสิทธิ์ให้ครู'))+'</section>'+
    '<section class="panel"><h3>สรุปสถานะวันนี้</h3>'+STATUS.map(s=>'<div class="list-row"><span>'+esc(LABEL[s])+'</span><strong>'+fmt(t[s])+' คน</strong></div>').join('')+'<div class="list-row"><span>ยังไม่เช็คชื่อ</span><strong>'+fmt(t.unmarked)+' คน</strong></div></section></div>'+
    '<div class="notice" style="margin-top:20px">ข้อมูลนี้ดึงจากฐานข้อมูลกลาง และแสดงเฉพาะห้องเรียนที่บัญชีของคุณมีสิทธิ์เข้าถึง</div>';
}
function renderAttendance(){
  const people=state.students.filter(s=>s.class_id===state.classId).sort((a,b)=>a.student_no-b.student_no);
  const t=tally(people);
  const rows=people.map(s=>{
    const rec=attendanceFor(s.id);
    const status=rec?.status || '';
    const buttons=STATUS.map(k=>'<button type="button" class="status '+(status===k?'selected '+k:'')+'" data-action="mark" data-id="'+esc(s.id)+'" data-status="'+k+'">'+LABEL[k]+'</button>').join('');
    return '<tr><td>'+fmt(s.student_no)+'</td><td><strong>'+esc(s.full_name)+'</strong><div class="small muted">'+esc(className(s.class_id))+'</div></td><td><div class="statuses">'+buttons+'</div></td><td class="actions">'+btn('note','หมายเหตุ','secondary sm','data-id="'+esc(s.id)+'"')+' '+btn('clear','ล้าง','secondary sm','data-id="'+esc(s.id)+'" '+(!status?'disabled':''))+(rec?.note?'<div class="small muted">'+esc(rec.note)+'</div>':'')+'</td></tr>';
  }).join('');
  $('pageContent').innerHTML='<div class="section-head"><div><h2>เช็คชื่อรายวัน</h2><div class="small muted">บันทึกสถานะแบบออนไลน์ แยกตามวันที่และชั้นเรียน</div></div>'+btn('bulk','✓ บันทึกที่ยังไม่เช็คเป็นมาเรียน','primary')+'</div>'+
    '<div class="panel"><div class="toolbar"><div class="field"><label for="attendanceClass">ชั้นเรียน</label><select class="control" id="attendanceClass" data-field="attendanceClass">'+opts(state.classId)+'</select></div>'+
    field('วันที่เช็คชื่อ','attendanceDate','date',state.date,'data-field="attendanceDate"')+
    '<div class="small muted" style="margin-bottom:8px">เช็คแล้ว '+fmt(people.length-t.unmarked)+' / '+fmt(people.length)+' คน</div>'+
    '<div style="margin-left:auto">'+btn('daily-csv','ส่งออก CSV','secondary')+'</div></div>'+
    (people.length?'<div class="table-wrap"><table class="data-table"><thead><tr><th>เลขที่</th><th>ชื่อ - นามสกุล</th><th>บันทึกสถานะ</th><th>เครื่องมือ</th></tr></thead><tbody>'+rows+'</tbody></table></div>':empty('ไม่มีรายชื่อในห้องนี้','เพิ่มรายชื่อนักเรียนก่อนเช็คชื่อ'))+'</div>';
}
function renderStudents(){
  let list=state.students.filter(s=>(state.studentClass==='all'||s.class_id===state.studentClass)&&
    (s.full_name+' '+s.student_no+' '+className(s.class_id)).toLocaleLowerCase().includes(state.search.toLocaleLowerCase()));
  list.sort((a,b)=>className(a.class_id).localeCompare(className(b.class_id),'th')||a.student_no-b.student_no);
  const rows=list.map(s=>'<tr><td>'+esc(className(s.class_id))+'</td><td>'+fmt(s.student_no)+'</td><td><strong>'+esc(s.full_name)+'</strong></td><td class="actions">'+btn('edit-student','แก้ไข','secondary sm','data-id="'+esc(s.id)+'"')+' '+btn('delete-student','ลบ','danger sm','data-id="'+esc(s.id)+'"')+'</td></tr>').join('');
  $('pageContent').innerHTML='<div class="section-head"><div><h2>รายชื่อนักเรียน</h2><div class="small muted">ข้อมูลถูกจัดเก็บในฐานข้อมูลกลางตามสิทธิ์ของบัญชีครู</div></div><div class="row-actions">'+btn('add-student','+ เพิ่มนักเรียน','primary')+btn('import-csv','นำเข้า CSV','secondary')+btn('student-csv','ส่งออก CSV','secondary')+'</div></div>'+
    '<div class="panel"><div class="toolbar"><div class="field"><label for="studentClass">ชั้นเรียน</label><select id="studentClass" class="control" data-field="studentClass">'+opts(state.studentClass,true)+'</select></div>'+
    field('ค้นหารายชื่อ','studentSearch','search',state.search,'data-field="studentSearch" placeholder="ชื่อหรือเลขที่"')+'</div>'+
    '<div class="small muted" style="margin-bottom:12px">พบ '+fmt(list.length)+' คน</div>'+
    (list.length?'<div class="table-wrap"><table class="data-table"><thead><tr><th>ชั้นเรียน</th><th>เลขที่</th><th>ชื่อ - นามสกุล</th><th>จัดการ</th></tr></thead><tbody>'+rows+'</tbody></table></div>':empty('ยังไม่มีนักเรียน','เลือกชั้นเรียนแล้วกดเพิ่มนักเรียน'))+
    '<input type="file" id="csvUpload" hidden accept=".csv,text/csv"><p class="small muted" style="margin-top:14px">รูปแบบ CSV: ชั้นเรียน,เลขที่,ชื่อ-นามสกุล · รองรับไฟล์ UTF-8 · หากเลขที่ซ้ำในห้องเดียวกัน ระบบจะอัปเดตชื่อเดิม</p></div>';
}
function reportPeople(){
  return state.students.filter(s=>state.reportClass==='all'||s.class_id===state.reportClass)
    .sort((a,b)=>className(a.class_id).localeCompare(className(b.class_id),'th')||a.student_no-b.student_no);
}
function reportRows(){
  const people=reportPeople(),allowed=new Set(people.map(x=>x.id)),totals={present:0,absent:0,late:0,sick:0,personal:0};
  const map=new Map(people.map(s=>[s.id,{student:s,count:{present:0,absent:0,late:0,sick:0,personal:0}}]));
  let entries=0;
  state.report.forEach(a=>{
    if(!allowed.has(a.student_id)||!Object.hasOwn(totals,a.status))return;
    const item=map.get(a.student_id);
    item.count[a.status]++;totals[a.status]++;entries++;
  });
  return {rows:[...map.values()],totals,entries};
}
function renderReports(){
  const d=state.reportReady?reportRows():null;
  const rows=d?d.rows.map(item=>'<tr><td>'+esc(className(item.student.class_id))+'</td><td>'+fmt(item.student.student_no)+'</td><td>'+esc(item.student.full_name)+'</td>'+
    STATUS.map(k=>'<td>'+fmt(item.count[k])+'</td>').join('')+'</tr>').join(''):'';
  $('pageContent').innerHTML='<div class="section-head"><div><h2>รายงานการเข้าเรียน</h2><div class="small muted">เลือกช่วงวันที่และดาวน์โหลดตารางสำหรับ Excel</div></div>'+btn('report-csv','ส่งออกรายงาน CSV','primary')+'</div>'+
    '<div class="panel"><div class="toolbar"><div class="field"><label for="reportClass">ชั้นเรียน</label><select class="control" id="reportClass" data-field="reportClass">'+opts(state.reportClass,true)+'</select></div>'+
    field('ตั้งแต่วันที่','reportFrom','date',state.from,'data-field="reportFrom"')+field('ถึงวันที่','reportTo','date',state.to,'data-field="reportTo"')+
    '<div style="margin-bottom:0">'+btn('load-report','แสดงรายงาน','secondary')+'</div></div>'+
    (!state.reportReady?'<div class="notice">กด “แสดงรายงาน” เพื่อดึงข้อมูลจากฐานข้อมูลกลางตามช่วงวันที่ที่เลือก</div>':
    '<div class="metrics" style="margin-bottom:18px">'+metric('รายการบันทึก',d.entries,'รายการ')+metric('มาเรียน',d.totals.present,'ครั้ง')+metric('มาสาย',d.totals.late,'ครั้ง')+metric('ขาดเรียน',d.totals.absent,'ครั้ง')+'</div>'+
    '<div class="table-wrap"><table class="data-table"><thead><tr><th>ชั้นเรียน</th><th>เลขที่</th><th>ชื่อ - นามสกุล</th><th>มา</th><th>ขาด</th><th>สาย</th><th>ลาป่วย</th><th>ลากิจ</th></tr></thead><tbody>'+rows+'</tbody></table></div>')+'</div>';
}
function renderManagement(){
  if(!isAdmin()){state.page='dashboard';return render();}
  const classRows=state.classes.map(c=>{
    const assigned=state.assignments.filter(a=>a.class_id===c.id).map(a=>{
      const teacher=state.profiles.find(p=>p.id===a.teacher_id);
      return '<div class="small muted">'+esc(teacher?.full_name || a.teacher_id)+' '+btn('unassign','ยกเลิก','danger sm','data-class="'+esc(c.id)+'" data-teacher="'+esc(a.teacher_id)+'"')+'</div>';
    }).join('');
    return '<div class="list-row"><div><b>'+esc(c.name)+'</b><div class="small muted">'+fmt(state.students.filter(s=>s.class_id===c.id).length)+' คน</div>'+assigned+'</div><div class="row-actions">'+btn('rename-class','แก้ไข','secondary sm','data-id="'+esc(c.id)+'"')+btn('delete-class','ลบ','danger sm','data-id="'+esc(c.id)+'"')+'</div></div>';
  }).join('');
  const teacherOptions=state.profiles.filter(p=>p.role==='teacher').map(p=>'<option value="'+esc(p.id)+'">'+esc(p.full_name||p.id)+'</option>').join('');
  $('pageContent').innerHTML='<div class="section-head"><div><h2>จัดการบัญชีครูและห้องเรียน</h2><div class="small muted">เมนูนี้สำหรับผู้ดูแลระบบเท่านั้น</div></div>'+btn('add-class','+ เพิ่มชั้นเรียน','primary')+'</div>'+
    '<div class="notice warn">บัญชีครูต้องสร้างจาก Supabase Dashboard &gt; Authentication &gt; Users โดยผู้ดูแลโครงการเท่านั้น เพื่อไม่เปิดเผยคีย์ลับในเว็บไซต์ หลังสร้างบัญชีแล้ว กดรีเฟรชข้อมูลเพื่อมอบหมายห้องเรียน</div>'+
    '<div class="two-cols"><section class="panel"><div class="panel-head"><h3>ชั้นเรียนและครูประจำห้อง</h3>'+btn('refresh','รีเฟรชข้อมูล','secondary sm')+'</div>'+(classRows||empty('ยังไม่มีชั้นเรียน','กดเพิ่มชั้นเรียน'))+'</section>'+
    '<section class="panel"><h3>มอบหมายสิทธิ์ครู</h3><div class="field"><label for="assignTeacher">เลือกบัญชีครู</label><select id="assignTeacher" class="control">'+teacherOptions+'</select></div>'+
    '<div class="field"><label for="assignClass">ชั้นเรียน</label><select id="assignClass" class="control">'+opts(state.classId)+'</select></div>'+
    '<div style="margin-top:15px">'+btn('assign','มอบหมายให้เข้าถึงห้องนี้','primary')+'</div>'+
    '<div style="margin-top:25px"><h3>บัญชีในระบบ</h3>'+state.profiles.map(p=>'<div class="list-row"><div><b>'+esc(p.full_name||'ยังไม่ระบุชื่อ')+'</b><div class="small muted">'+esc(p.id.slice(0,8))+'...</div></div><span class="tag">'+(p.role==='admin'?'ผู้ดูแล':'ครู')+'</span></div>').join('')+'</div></section></div>';
}
async function mutate(operation,done){
  if(busy)return;
  setBusy(true);
  try {
    const r=await operation();
    if(r?.error)throw r.error;
    await reloadAll();
    render();
    toast(done||'บันทึกข้อมูลลงฐานข้อมูลกลางแล้ว');
  }catch(e){toast(errorText(e),true);}finally{setBusy(false);}
}
async function mark(studentId,status){
  if(!getStudent(studentId)||!STATUS.includes(status))return;
  const existing=attendanceFor(studentId);
  await mutate(()=>db.from('attendance').upsert({
    student_id:studentId,attendance_date:state.date,status,
    note:existing?.note||''
  },{onConflict:'student_id,attendance_date'}),'บันทึกการเช็คชื่อแล้ว');
}
async function clear(studentId){
  if(!attendanceFor(studentId))return;
  await mutate(()=>db.from('attendance').delete().eq('student_id',studentId).eq('attendance_date',state.date),'ล้างสถานะแล้ว');
}
async function note(studentId){
  const record=attendanceFor(studentId),student=getStudent(studentId);
  if(!record || !student){toast('กรุณาเช็คชื่อก่อนเพิ่มหมายเหตุ',true);return;}
  const text=prompt('หมายเหตุ: '+student.full_name,record.note||'');
  if(text===null)return;
  if(text.length>1000){toast('หมายเหตุยาวเกิน 1,000 ตัวอักษร',true);return;}
  await mutate(()=>db.from('attendance').update({note:text}).eq('id',record.id),'บันทึกหมายเหตุแล้ว');
}
async function bulk(){
  if(!state.classId)return toast('เลือกชั้นเรียนก่อน',true);
  const others=state.students.filter(s=>s.class_id===state.classId&&!attendanceFor(s.id));
  if(!others.length)return toast('นักเรียนห้องนี้เช็คชื่อครบแล้ว');
  if(!confirm('บันทึกที่ยังไม่เช็คทั้งหมด '+others.length+' คนเป็น “มาเรียน” ใช่หรือไม่?'))return;
  if(busy)return;setBusy(true);
  try{
    for(let i=0;i<others.length;i+=100){
      const data=others.slice(i,i+100).map(s=>({student_id:s.id,attendance_date:state.date,status:'present',note:''}));
      const {error}=await db.from('attendance').upsert(data,{onConflict:'student_id,attendance_date'});
      if(error)throw error;
    }
    await reloadAll();render();toast('บันทึกที่ยังไม่เช็คทั้งหมดแล้ว');
  }catch(e){await loadDaily();render();toast(errorText(e)+' (ตรวจสอบข้อมูลบางส่วนที่อาจบันทึกแล้ว)',true);}
  finally{setBusy(false);}
}
function chooseClass(defaultId){
  if(!state.classes.length){toast('ผู้ดูแลระบบต้องเพิ่มชั้นเรียนก่อน',true);return null;}
  const choice=prompt('ชื่อชั้นเรียน (ต้องตรงกับรายการ): '+state.classes.map(c=>c.name).join(', '),className(defaultId||state.classId));
  if(choice===null)return null;
  const found=state.classes.find(c=>c.name===choice.trim());
  if(!found)toast('ไม่พบชื่อชั้นเรียน กรุณากรอกตามรายการ',true);
  return found || null;
}
async function studentForm(id){
  const old=id?getStudent(id):null;
  const cls=chooseClass(old?.class_id||state.classId);
  if(!cls)return;
  const numStr=prompt('เลขที่นักเรียน (1-999)',old?String(old.student_no):'1');
  if(numStr===null)return;
  const no=Number(numStr);
  if(!Number.isInteger(no)||no<1||no>999)return toast('เลขที่ต้องเป็นตัวเลขจำนวนเต็ม 1-999',true);
  const fullName=prompt('ชื่อ-นามสกุลนักเรียน',old?.full_name||'');
  if(fullName===null)return;
  if(!fullName.trim()||fullName.trim().length>200)return toast('กรอกชื่อให้ถูกต้อง ไม่เกิน 200 ตัวอักษร',true);
  const payload={class_id:cls.id,student_no:no,full_name:fullName.trim()};
  if(old)await mutate(()=>db.from('students').update(payload).eq('id',old.id),'แก้ไขข้อมูลนักเรียนแล้ว');
  else await mutate(()=>db.from('students').insert(payload),'เพิ่มนักเรียนแล้ว');
}
async function deleteStudent(id){
  const s=getStudent(id);
  if(!s||!confirm('ลบ '+s.full_name+' และประวัติการเช็คชื่อทั้งหมดอย่างถาวร ใช่หรือไม่?'))return;
  await mutate(()=>db.from('students').delete().eq('id',id),'ลบนักเรียนแล้ว');
}
async function classForm(id){
  if(!isAdmin())return;
  const c=id?state.classes.find(x=>x.id===id):null;
  const n=prompt(c?'แก้ไขชื่อชั้นเรียน':'เพิ่มชั้นเรียน',c?.name||'');
  if(n===null)return;
  if(n.trim().length<1||n.trim().length>100)return toast('กรอกชื่อชั้นเรียนไม่เกิน 100 ตัวอักษร',true);
  if(c)await mutate(()=>db.from('school_classes').update({name:n.trim()}).eq('id',id),'แก้ไขชั้นเรียนแล้ว');
  else await mutate(()=>db.from('school_classes').insert({name:n.trim()}),'เพิ่มชั้นเรียนแล้ว');
}
async function deleteClass(id){
  if(!isAdmin())return;
  const c=state.classes.find(x=>x.id===id);
  if(!c||!confirm('ลบชั้นเรียน '+c.name+'? (ต้องไม่มีนักเรียนในห้อง)'))return;
  await mutate(()=>db.from('school_classes').delete().eq('id',id),'ลบชั้นเรียนแล้ว');
}
async function assign(){
  if(!isAdmin())return;
  const teacherId=$('assignTeacher')?.value,clsId=$('assignClass')?.value;
  if(!teacherId||!clsId)return toast('เลือกครูและชั้นเรียนก่อน',true);
  await mutate(()=>db.from('class_teachers').upsert({teacher_id:teacherId,class_id:clsId},{onConflict:'class_id,teacher_id'}),'มอบหมายห้องเรียนเรียบร้อย');
}
async function unassign(classId,teacherId){
  if(!isAdmin()||!confirm('ยกเลิกสิทธิ์ครูในชั้นเรียนนี้ ใช่หรือไม่?'))return;
  await mutate(()=>db.from('class_teachers').delete().eq('class_id',classId).eq('teacher_id',teacherId),'ยกเลิกสิทธิ์แล้ว');
}
async function loadReport(){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(state.from)||!/^\d{4}-\d{2}-\d{2}$/.test(state.to)||state.from>state.to)
    return toast('เลือกช่วงวันที่ให้ถูกต้อง',true);
  const span=(new Date(state.to+'T12:00:00')-new Date(state.from+'T12:00:00'))/86400000;
  if(span>366)return toast('กรุณาเลือกช่วงเวลาไม่เกิน 366 วันต่อครั้ง',true);
  if(busy)return;setBusy(true);
  try {
    state.report=await pages('attendance','id,student_id,attendance_date,status','id',
      q=>q.gte('attendance_date',state.from).lte('attendance_date',state.to));
    state.reportReady=true;render();toast('โหลดรายงานจากฐานข้อมูลแล้ว');
  }catch(e){toast(errorText(e),true);}finally{setBusy(false);}
}
function csvSafe(v){let x=String(v==null?'':v);if(/^[\s]*[=+\-@\t\r]/.test(x))x="'"+x;return '"'+x.replace(/"/g,'""')+'"';}
function csvExport(name,rows){
  const blob=new Blob(['\ufeff'+rows.map(r=>r.map(csvSafe).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const link=document.createElement('a'),u=URL.createObjectURL(blob);
  link.href=u;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);
}
function dailyCSV(){
  const rows=[['ชั้นเรียน','วันที่','เลขที่','ชื่อ-นามสกุล','สถานะ','หมายเหตุ']];
  state.students.filter(s=>s.class_id===state.classId).sort((a,b)=>a.student_no-b.student_no).forEach(s=>{
    const a=attendanceFor(s.id);
    rows.push([className(s.class_id),state.date,s.student_no,s.full_name,a?LABEL[a.status]:'ยังไม่เช็ค',a?.note||'']);
  });
  csvExport('เช็คชื่อ_'+state.date+'.csv',rows);
}
function studentsCSV(){
  const rows=[['ชั้นเรียน','เลขที่','ชื่อ-นามสกุล']];
  state.students.filter(s=>state.studentClass==='all'||s.class_id===state.studentClass)
    .sort((a,b)=>className(a.class_id).localeCompare(className(b.class_id),'th')||a.student_no-b.student_no)
    .forEach(s=>rows.push([className(s.class_id),s.student_no,s.full_name]));
  csvExport('รายชื่อนักเรียน.csv',rows);
}
function reportCSV(){
  if(!state.reportReady)return toast('กดแสดงรายงานก่อนส่งออก',true);
  const rows=[['ชั้นเรียน','เลขที่','ชื่อ-นามสกุล','มาเรียน','ขาดเรียน','มาสาย','ลาป่วย','ลากิจ']];
  reportRows().rows.forEach(({student,count})=>rows.push([className(student.class_id),student.student_no,student.full_name,
    count.present,count.absent,count.late,count.sick,count.personal]));
  csvExport('รายงานการเข้าเรียน_'+state.from+'_'+state.to+'.csv',rows);
}
function parseCSV(raw){
  const text=raw.replace(/^\ufeff/,'');
  const out=[];let row=[],cell='',inQuotes=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(inQuotes){if(ch==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(ch==='"')inQuotes=false;else cell+=ch;}
    else if(ch==='"')inQuotes=true;
    else if(ch===','){row.push(cell);cell='';}
    else if(ch==='\n'){row.push(cell.replace(/\r$/,''));out.push(row);row=[];cell='';}
    else cell+=ch;
  }
  if(inQuotes)throw new Error('CSV มีเครื่องหมายอัญประกาศไม่ครบ');
  if(cell||row.length){row.push(cell.replace(/\r$/,''));out.push(row);}
  return out;
}
async function importCSV(file){
  if(!file)return;
  if(file.size>2*1024*1024)return toast('ไฟล์ CSV ต้องมีขนาดไม่เกิน 2 MB',true);
  try{
    const lines=parseCSV(await file.text()).filter(row=>row.some(v=>v.trim()));
    if(lines.length<2)return toast('ไม่มีข้อมูลนักเรียนในไฟล์ CSV',true);
    const header=lines.shift().map(x=>x.replace(/\s/g,'').toLowerCase());
    const col=(names)=>header.findIndex(x=>names.includes(x));
    const iClass=col(['ชั้นเรียน','ห้องเรียน','class']),iNo=col(['เลขที่','number','studentno']),iName=col(['ชื่อ-นามสกุล','ชื่อสกุล','fullname','name']);
    if(iClass<0||iNo<0||iName<0)return toast('หัวตาราง CSV ต้องมี ชั้นเรียน,เลขที่,ชื่อ-นามสกุล',true);
    if(lines.length>2000)return toast('นำเข้าได้ครั้งละไม่เกิน 2,000 คน',true);
    const list=[];
    for(const row of lines){
      const c=state.classes.find(x=>x.name===(row[iClass]||'').trim());
      const n=Number((row[iNo]||'').trim()),name=(row[iName]||'').trim();
      if(!c||!Number.isInteger(n)||n<1||n>999||!name||name.length>200)
        throw new Error('พบข้อมูลชั้นเรียน/เลขที่/ชื่อไม่ถูกต้อง กรุณาแก้ไขไฟล์');
      list.push({class_id:c.id,student_no:n,full_name:name});
    }
    const unique=new Set(list.map(x=>x.class_id+'|'+x.student_no));
    if(unique.size!==list.length)throw new Error('พบเลขที่ซ้ำในชั้นเรียนเดียวกันภายในไฟล์');
    if(!confirm('นำเข้ารายชื่อนักเรียน '+list.length+' คนลงฐานข้อมูลกลาง? เลขที่ที่มีอยู่แล้วจะอัปเดตชื่อ'))return;
    if(busy)return;setBusy(true);
    try{
      for(let i=0;i<list.length;i+=100){
        const {error}=await db.from('students').upsert(list.slice(i,i+100),{onConflict:'class_id,student_no'});
        if(error)throw error;
      }
      await reloadAll();render();toast('นำเข้ารายชื่อนักเรียนเรียบร้อย');
    }catch(e){await reloadAll();render();toast(errorText(e)+' (บางแถวอาจถูกบันทึกแล้ว)',true);}
    finally{setBusy(false);}
  }catch(e){toast(errorText(e),true);}
}
async function handleAction(button){
  if(busy)return;
  const action=button.dataset.action,id=button.dataset.id;
  if(action==='go-attendance'){state.page='attendance';render();}
  if(action==='mark')await mark(id,button.dataset.status);
  if(action==='clear')await clear(id);
  if(action==='note')await note(id);
  if(action==='bulk')await bulk();
  if(action==='daily-csv')dailyCSV();
  if(action==='add-student')await studentForm();
  if(action==='edit-student')await studentForm(id);
  if(action==='delete-student')await deleteStudent(id);
  if(action==='student-csv')studentsCSV();
  if(action==='import-csv')$('csvUpload').click();
  if(action==='load-report')await loadReport();
  if(action==='report-csv')reportCSV();
  if(action==='add-class')await classForm();
  if(action==='rename-class')await classForm(id);
  if(action==='delete-class')await deleteClass(id);
  if(action==='assign')await assign();
  if(action==='unassign')await unassign(button.dataset.class,button.dataset.teacher);
  if(action==='refresh'){setBusy(true);try{await reloadAll();render();toast('อัปเดตข้อมูลแล้ว');}catch(e){toast(errorText(e),true);}finally{setBusy(false);}}
}
function init(){
  $('loginForm').addEventListener('submit',async e=>{
    e.preventDefault();if(busy)return;
    $('loginMessage').textContent='';
    setBusy(true);$('loginBtn').disabled=true;
    try{
      const {error}=await db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});
      if(error)throw error;
      $('password').value='';
      await signedIn();
    }catch(err){$('loginMessage').textContent='เข้าสู่ระบบไม่ได้: กรุณาตรวจสอบอีเมล รหัสผ่าน หรือสิทธิ์บัญชี';}
    finally{$('loginBtn').disabled=false;setBusy(false);}
  });
  $('logoutBtn').addEventListener('click',async()=>{if(busy)return;try{await db.auth.signOut();state.user=null;state.profile=null;state.students=[];state.daily=[];state.report=[];show('loginScreen');}catch(e){toast(errorText(e),true);}});
  $('menuToggle').addEventListener('click',()=>$('sidebar').classList.toggle('open'));
  $('navigation').addEventListener('click',e=>{
    const button=e.target.closest('[data-page]');if(!button)return;
    if(button.dataset.page==='management'&&!isAdmin())return;
    state.page=button.dataset.page;render();
  });
  $('pageContent').addEventListener('click',async e=>{
    const button=e.target.closest('button[data-action]');if(button)await handleAction(button);
  });
  $('pageContent').addEventListener('change',async e=>{
    const field=e.target.dataset.field;
    if(field==='attendanceClass'){state.classId=e.target.value;renderAttendance();}
    if(field==='attendanceDate'){
      state.date=e.target.value||localDate(new Date());setBusy(true);
      try{await loadDaily();render();}catch(err){toast(errorText(err),true);}finally{setBusy(false);}
    }
    if(field==='studentClass'){state.studentClass=e.target.value;renderStudents();}
    if(field==='reportClass'){state.reportClass=e.target.value;state.reportReady=false;renderReports();}
    if(field==='reportFrom'){state.from=e.target.value;state.reportReady=false;renderReports();}
    if(field==='reportTo'){state.to=e.target.value;state.reportReady=false;renderReports();}
    if(e.target.id==='csvUpload'){await importCSV(e.target.files?.[0]);e.target.value='';}
  });
  $('pageContent').addEventListener('input',e=>{
    if(e.target.dataset.field==='studentSearch'){
      const pos=e.target.selectionStart;state.search=e.target.value;
      renderStudents();const el=$('studentSearch');el.focus();el.setSelectionRange(pos,pos);
    }
  });
  if(!ready){show('setupScreen');return;}
  db=createClient(url,key,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:false}});
  db.auth.onAuthStateChange((event)=>{
    if(event==='SIGNED_OUT'){state.user=null;state.profile=null;state.students=[];state.daily=[];state.report=[];show('loginScreen');}
  });
  signedIn();
}
init();
