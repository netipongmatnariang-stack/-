import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.0';
const cfg=window.APP_CONFIG||{};
const db=createClient(cfg.supabaseUrl,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
const $=id=>document.getElementById(id);
const h=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const dateTH=v=>v?new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeZone:'Asia/Bangkok'}).format(new Date(String(v).slice(0,10)+'T12:00:00+07:00')):'-';
const safeLink=v=>{try{const u=new URL(v);return ['https:','http:'].includes(u.protocol)?h(u.href):'#'}catch{return '#'}};
let S={user:null,profile:null,admin:false,tab:'overview',subjects:[],terms:[],classes:[],students:[],sections:[],paCycles:[],indicators:[],evidence:[],portfolio:[],
 courseId:'',sessionId:'',taskId:'',date:today(),period:1,units:[],sessions:[],periodRows:[],tasks:[],submissions:[],reviews:[],scores:[],assessments:[],studentAccounts:[],busy:false};
const name=(arr,id,k='name')=>arr.find(a=>a.id===id)?.[k]||'-';
const choices=(arr,current='',k='name')=>arr.map(x=>'<option value="'+h(x.id)+'"'+(x.id===current?' selected':'')+'>'+h(x[k])+'</option>').join('');
const option=(key,label,val='',type='text',more='')=>'<label>'+h(label)+'<input class="in" name="'+h(key)+'" type="'+type+'" value="'+h(val)+'" '+more+'></label>';
const area=(key,label,val='')=>'<label>'+h(label)+'<textarea name="'+h(key)+'" class="in">'+h(val)+'</textarea></label>';
const choose=(key,label,arr,val='',txt='name')=>'<label>'+h(label)+'<select class="in" name="'+h(key)+'" required>'+choices(arr,val,txt)+'</select></label>';
const tick=(key,label,val=false)=>'<label style="display:flex;gap:9px;align-items:center"><input type="checkbox" name="'+h(key)+'" '+(val?'checked':'')+'>'+h(label)+'</label>';
function note(message,bad=false){const el=$('message');el.textContent=message;el.className=bad?'error':'success';el.hidden=false;el.scrollIntoView({behavior:'smooth',block:'nearest'});}
function errorMessage(e){if(e?.code==='23505')return 'มีข้อมูลนี้อยู่แล้ว';if(e?.code==='23503')return 'รายการนี้มีข้อมูลที่เชื่อมโยงอยู่';return e?.message||String(e);}
async function query(table,cols='*',sort=null){
 let r=db.from(table).select(cols);
 if(sort)r=r.order(sort);
 const {data,error}=await r.limit(1000);if(error)throw error;return data||[];
}
async function write(table,values,id){const q=db.from(table);const {error}=await(id?q.update(values).eq('id',id):q.insert(values));if(error)throw error;}
async function del(table,id){const {error}=await db.from(table).delete().eq('id',id);if(error)throw error;}
function editor(title,fields,callback){
 $('editorTitle').textContent=title;$('editorFields').innerHTML=fields;$('editorError').hidden=true;
 S.save=callback;$('editor').showModal();
}
async function loadAll(){
 const names=['teacher_subjects','academic_terms','school_classes','students','course_sections','pa_cycles','pa_indicators','pa_evidence','teacher_portfolio','student_accounts'];
 const lists=await Promise.all(names.map(t=>query(t)));
 [S.subjects,S.terms,S.classes,S.students,S.sections,S.paCycles,S.indicators,S.evidence,S.portfolio,S.studentAccounts]=lists;
 S.terms.sort((a,b)=>b.academic_year-a.academic_year||b.term_no-a.term_no);
 S.sections.sort((a,b)=>name(S.subjects,a.subject_id).localeCompare(name(S.subjects,b.subject_id),'th'));
 S.indicators.sort((a,b)=>a.code.localeCompare(b.code,'en',{numeric:true}));
 if(!S.sections.some(x=>x.id===S.courseId))S.courseId=S.sections[0]?.id||'';
}
function sectionLabel(x){return name(S.subjects,x.subject_id)+' · '+name(S.classes,x.class_id)+' · '+name(S.terms,x.term_id,'term_name');}
function currentSection(){return S.sections.find(x=>x.id===S.courseId)}
function classStudents(){const c=currentSection();return S.students.filter(x=>x.class_id===c?.class_id).sort((a,b)=>a.student_no-b.student_no)}
const head=(title,extra='')=>'<div class="row" style="justify-content:space-between"><h2>'+h(title)+'</h2>'+extra+'</div>';
const item=(title,details,buttons='')=>'<article class="item"><div class="row" style="justify-content:space-between"><div><h3>'+h(title)+'</h3><p class="muted">'+h(details)+'</p></div><div class="row">'+buttons+'</div></div></article>';
const btn=(action,label,id='',style='')=>'<button type="button" class="act '+style+'" data-action="'+h(action)+'" data-id="'+h(id)+'">'+h(label)+'</button>';
const coursePick=()=>'<label class="row">รายวิชา/ห้องเรียน<select class="in" id="coursePicker">'+choices(S.sections,S.courseId,'display')+'</select></label>';
function chooseCourse(){
 if(!S.sections.length)return '<div class="panel"><p class="tip">ยังไม่มีรายวิชาที่ผูกกับห้องเรียน โปรดสร้างที่เมนูรายวิชา/ชั้นเรียนก่อน</p></div>';
 return '<div class="toolbar"><label>เลือกรายวิชาและห้องเรียน<select class="in" id="coursePicker">'+S.sections.map(x=>'<option value="'+h(x.id)+'"'+(x.id===S.courseId?' selected':'')+'>'+h(sectionLabel(x))+'</option>').join('')+'</select></label></div>';
}
function overview(){
 $('view').innerHTML='<div class="panel"><h2>ภาพรวม Teacher Smart Portal</h2>'+
 '<div class="cards">'+[
 ['รายวิชา/ห้องเรียน',S.sections.length],['นักเรียน',S.students.length],['แฟ้ม วPA',S.evidence.length],['รายการผลงาน',S.portfolio.length]
 ].map(x=>'<div class="card-mini"><span class="muted">'+x[0]+'</span><strong>'+x[1].toLocaleString('th-TH')+'</strong></div>').join('')+'</div>'+
 '<p class="tip">ตัวเลขทั้งหมดอ่านจากฐานข้อมูลจริง ระบบนี้ใช้ร่วมกับห้องเรียนดิจิทัลเดิมโดยไม่ลบข้อมูลก่อนหน้า</p></div>'+
 '<div class="split"><div class="panel"><h2>เริ่มต้นใช้งาน</h2><p>1. สร้างห้องเรียน และรายวิชาในภาคเรียน<br>2. เพิ่มรายชื่อนักเรียน<br>3. บันทึกคาบเรียนและการเข้าเรียน<br>4. สั่งงาน ตรวจงาน และบันทึกคะแนน</p>'+
 btn('go-courses','จัดการรายวิชา','','primary')+'</div><div class="panel"><h2>แฟ้ม วPA</h2><p>แสดงตัวชี้วัด 3 ด้าน 15 ตัวชี้วัด พร้อมเก็บหลักฐานแยกตามปีงบประมาณ</p>'+
 (S.admin?btn('go-pa','จัดการหลักฐาน วPA','','primary'):'<p class="muted">ใช้สิทธิ์ผู้ดูแลเพื่อเพิ่มหลักฐาน</p>')+'</div></div>';
}
function courses(){
 const rows=S.sections.map(x=>item(sectionLabel(x),'คาบ/สัปดาห์: '+x.periods_per_week+' · เกณฑ์เวลาเรียน '+x.minimum_attendance+'% · '+(x.is_published?'เปิดเผยแพร่ให้นักเรียน':'ยังไม่เผยแพร่'),
 btn('open-course','เปิดรายวิชา',x.id,'primary')+btn('edit-course','แก้ไข',x.id)+btn('delete-course','ลบ',x.id,'danger'))).join('');
 let u='';
 if(currentSection())u='<div class="panel">'+head('หน่วยการเรียนรู้',btn('add-unit','+ เพิ่มหน่วย'))+
 (S.units.length?S.units.map(x=>item('หน่วยที่ '+x.sequence_no+' '+x.title,x.summary+' · '+(x.is_published?'เผยแพร่':'ฉบับร่าง'),
 btn('edit-unit','แก้ไข',x.id)+btn('delete-unit','ลบ',x.id,'danger'))).join(''):'<p class="muted">ยังไม่มีหน่วยการเรียนรู้ในรายวิชานี้</p>')+'</div>';
 $('view').innerHTML='<div class="panel">'+head('รายวิชาและห้องเรียน',btn('add-course','+ เปิดสอนรายวิชา','','primary'))+
 '<p class="muted">ผูกรายวิชากับห้องเรียนและภาคเรียน กำหนดจำนวนคาบ เวลาเรียนขั้นต่ำ และเผยแพร่ให้นักเรียน</p>'+
 (S.admin?'<div class="toolbar">'+btn('add-class','+ เพิ่มห้องเรียน')+btn('add-term','+ เพิ่มภาคเรียน')+'</div>':'')+
 (rows||'<p class="tip">ยังไม่มีรายวิชาที่เปิดสอน กดปุ่ม “เปิดสอนรายวิชา”</p>')+'</div>'+u;
}
async function courseModal(id){
 const x=S.sections.find(y=>y.id===id)||{};
 if(!S.subjects.length||!S.classes.length||!S.terms.length)return note('ต้องมีชื่อรายวิชา ห้องเรียน และภาคเรียนก่อนเปิดสอน',true);
 editor(id?'แก้ไขการเปิดสอน':'เปิดสอนรายวิชา',
 choose('subject_id','รายวิชา',S.subjects,x.subject_id)+choose('class_id','ชั้นเรียน',S.classes,x.class_id)+
 choose('term_id','ภาคเรียน',S.terms.map(t=>({...t,name:t.term_name||String(t.academic_year)+'/'+t.term_no})),x.term_id)+
 option('periods_per_week','จำนวนคาบต่อสัปดาห์',x.periods_per_week||1,'number','min="1" max="30" required')+
 option('minimum_attendance','เกณฑ์เวลาเรียนขั้นต่ำ (%)',x.minimum_attendance??80,'number','min="0" max="100" step="0.01" required')+
 option('late_weight','น้ำหนักมาสาย (0 ถึง 1)',x.late_weight??1,'number','min="0" max="1" step="0.01" required')+
 option('leave_weight','น้ำหนักวันลา (0 ถึง 1)',x.leave_weight??0,'number','min="0" max="1" step="0.01" required')+
 tick('is_published','ให้นักเรียนที่มีบัญชีเห็นรายวิชานี้',x.is_published),
 async f=>{
 const v={subject_id:f.get('subject_id'),class_id:f.get('class_id'),term_id:f.get('term_id'),
 periods_per_week:Number(f.get('periods_per_week')),minimum_attendance:Number(f.get('minimum_attendance')),
 late_weight:Number(f.get('late_weight')),leave_weight:Number(f.get('leave_weight')),is_published:f.has('is_published')};
 await write('course_sections',v,id);await loadAll();draw();
 });
}
async function classModal(){
 editor('เพิ่มห้องเรียน',option('name','ชื่อห้องเรียน เช่น ป.5/1','','text','maxlength="120" required'),async f=>{
 const value=String(f.get('name')||'').trim();if(!value)throw Error('กรุณากรอกชื่อห้องเรียน');
 await write('school_classes',{name:value});await loadAll();draw();
 });
}
async function termModal(){
 editor('เพิ่มภาคเรียน',option('academic_year','ปีการศึกษา (พ.ศ.)',2569,'number','min="2500" max="2700" required')+
 option('term_no','ภาคเรียน',1,'number','min="1" max="3" required')+
 option('term_name','ชื่อภาคเรียน','','text','maxlength="150"'),async f=>{
 const year=Number(f.get('academic_year')),term=Number(f.get('term_no'));
 await write('academic_terms',{academic_year:year,term_no:term,term_name:f.get('term_name')||'ภาคเรียนที่ '+term+' ปีการศึกษา '+year});
 await loadAll();draw();
 });
}
async function unitModal(id){
 const x=S.units.find(y=>y.id===id)||{};if(!currentSection())return;
 editor(id?'แก้ไขหน่วยการเรียนรู้':'เพิ่มหน่วยการเรียนรู้',
 option('sequence_no','หน่วยที่',x.sequence_no||S.units.length+1,'number','min="1" max="10000" required')+
 option('title','ชื่อหน่วย',x.title||'','text','maxlength="200" required')+
 area('summary','คำอธิบาย/กิจกรรม',x.summary||'')+
 option('resource_url','ลิงก์สื่อการสอน HTTPS (ถ้ามี)',x.resource_url||'','url')+
 tick('is_published','เผยแพร่หน่วยเรียนให้นักเรียน',x.is_published),async f=>{
 await write('course_units',{section_id:S.courseId,sequence_no:Number(f.get('sequence_no')),title:String(f.get('title')).trim(),
 summary:String(f.get('summary')||''),resource_url:String(f.get('resource_url')||''),is_published:f.has('is_published')},id);
 await refreshCourse();draw();
 });
}
async function refreshCourse(){
 S.units=S.courseId?await query('course_units'):[];S.units=S.units.filter(x=>x.section_id===S.courseId).sort((a,b)=>a.sequence_no-b.sequence_no);
}
function studentPage(){
 const classes=S.classes.map(c=>item(c.name,S.students.filter(p=>p.class_id===c.id).length+' คน')).join('');
 const students=S.students.slice().sort((a,b)=>name(S.classes,a.class_id).localeCompare(name(S.classes,b.class_id),'th')||a.student_no-b.student_no);
 $('view').innerHTML='<div class="panel">'+head('ข้อมูลนักเรียน',btn('add-student','+ เพิ่มนักเรียน','','primary'))+
 '<p class="muted">ข้อมูลนักเรียนแสดงตามสิทธิ์ของบัญชีครู บัญชีนักเรียนต้องเชื่อมโยงเป็นรายบุคคลก่อนเข้าพอร์ทัลนักเรียน</p>'+
 '<div class="toolbar">'+(S.admin?btn('link-student','เชื่อมบัญชีนักเรียน (Admin)'):'')+
 '<a class="act" href="../online/">นำเข้า CSV / จัดการชั้นเรียนเดิม</a></div>'+
 '<div class="table-scroll"><table class="data"><thead><tr><th>ชั้นเรียน</th><th>เลขที่</th><th>ชื่อ-นามสกุล</th><th>จัดการ</th></tr></thead><tbody>'+
 students.map(x=>'<tr><td>'+h(name(S.classes,x.class_id))+'</td><td>'+h(x.student_no)+'</td><td>'+h(x.full_name)+'</td><td>'+btn('edit-student','แก้ไข',x.id)+'</td></tr>').join('')+'</tbody></table></div>'+
 (!students.length?'<p class="tip">ยังไม่มีนักเรียน เพิ่มชั้นเรียนก่อน แล้วเพิ่มรายชื่อนักเรียน</p>':'')+'</div>';
}
function studentModal(id){
 const x=S.students.find(y=>y.id===id)||{};
 if(!S.classes.length)return note('กรุณาเพิ่มห้องเรียนก่อน',true);
 editor(id?'แก้ไขนักเรียน':'เพิ่มนักเรียน',
 choose('class_id','ชั้นเรียน',S.classes,x.class_id)+option('student_no','เลขที่',x.student_no||1,'number','min="1" max="999" required')+
 option('full_name','ชื่อ-นามสกุล',x.full_name||'','text','maxlength="200" required'),async f=>{
 await write('students',{class_id:f.get('class_id'),student_no:Number(f.get('student_no')),full_name:String(f.get('full_name')).trim()},id);
 await loadAll();draw();
 });
}
function linkStudent(){
 if(!S.admin)return;
 const candidates=S.students.filter(p=>!S.studentAccounts.some(x=>x.student_id===p.id));
 if(!candidates.length)return note('ไม่มีนักเรียนที่ยังไม่ได้เชื่อมบัญชี',true);
 editor('เชื่อมบัญชีนักเรียนกับ Supabase Auth',
 '<p class="tip">สร้างบัญชีใน Supabase → Authentication → Users ก่อน คัดลอก User UID ของนักเรียน (อย่าใช้รหัสผ่าน) แล้วเลือกนักเรียนที่ต้องการผูกบัญชี</p>'+
 choose('student_id','นักเรียน',candidates.map(x=>({...x,name:x.full_name+' · '+name(S.classes,x.class_id)})))+
 option('user_id','User UID จาก Supabase Auth','','text','pattern="[0-9a-fA-F-]{36}" required'),async f=>{
 const sid=f.get('student_id'),student=S.students.find(x=>x.id===sid),uid=String(f.get('user_id')||'').trim();
 if(!student)throw Error('ไม่พบนักเรียน');
 const {error}=await db.from('student_accounts').insert({student_id:sid,class_id:student.class_id,user_id:uid});
 if(error)throw error;await loadAll();draw();
 });
}
function sessionPage(){
 if(!currentSection()){ $('view').innerHTML=chooseCourse();return;}
 const held=S.sessions.filter(x=>x.section_id===S.courseId&&x.is_held).sort((a,b)=>a.session_date.localeCompare(b.session_date)||a.period_no-b.period_no);
 const rows=S.periodRows;
 const report=classStudents().map(st=>{
 const mine=rows.filter(x=>x.student_id===st.id&&held.some(s=>s.id===x.session_id));
 const byStatus=Object.fromEntries(['present','late','absent','sick','personal','other'].map(status=>[status,mine.filter(x=>x.status===status).length]));
 const total=held.length;
 const weighted=(byStatus.present||0)+(byStatus.late||0)*Number(currentSection().late_weight)+(byStatus.sick+byStatus.personal)*Number(currentSection().leave_weight);
 const percent=total>0?Math.round(weighted/total*10000)/100:0;
 return '<tr><td>'+h(st.student_no)+'</td><td>'+h(st.full_name)+'</td><td>'+total+'</td><td>'+byStatus.present+'</td><td>'+byStatus.absent+'</td><td>'+byStatus.late+'</td><td>'+(byStatus.sick+byStatus.personal)+'</td><td><strong style="color:'+(total&&percent<Number(currentSection().minimum_attendance)?'#c44b4b':'#0f725c')+'">'+(total?percent+'%':'-')+'</strong></td></tr>';
 }).join('');
 const open=S.sessions.filter(x=>x.section_id===S.courseId).sort((a,b)=>b.session_date.localeCompare(a.session_date)||b.period_no-a.period_no);
 $('view').innerHTML=chooseCourse()+'<div class="panel">'+head('เช็คชื่อรายคาบ',btn('add-session','+ เพิ่มคาบเรียน','','primary'))+
 '<div class="tip">นับเฉพาะคาบที่สอนจริง สถานะที่ยังไม่เช็คถือว่าไม่ได้มาเรียน ค่าเริ่มต้นมาสายคิด 100% และการลา 0% สามารถเปลี่ยนเกณฑ์ในหน้ารายวิชา</div>'+
 '<div class="toolbar"><label>เลือกคาบเรียน<select class="in" id="sessionPicker"><option value="">เลือกคาบ</option>'+open.map(x=>'<option value="'+h(x.id)+'"'+(x.id===S.sessionId?' selected':'')+'>'+h(dateTH(x.session_date))+' · คาบ '+x.period_no+' '+h(x.topic||'')+'</option>').join('')+'</select></label>'+
 (S.sessionId?btn('mark-all','✓ เช็คที่เหลือเป็นมาเรียน','','primary')+btn('delete-session','ลบคาบเรียน',S.sessionId,'danger'):'')+'</div>'+
 (S.sessionId?renderSessionStudents():'<p class="muted">เลือกคาบเรียนที่บันทึกไว้เพื่อเช็คชื่อ</p>')+'</div>'+
 '<div class="panel">'+head('สรุปเวลาเรียน',btn('attendance-csv','ส่งออก CSV'))+
 '<div class="table-scroll"><table class="data"><thead><tr><th>เลขที่</th><th>ชื่อ</th><th>คาบทั้งหมด</th><th>มา</th><th>ขาด</th><th>สาย</th><th>ลา</th><th>เวลาเรียน</th></tr></thead><tbody>'+report+'</tbody></table></div></div>';
}
function renderSessionStudents(){
 const list=classStudents();const labels={present:'มาเรียน',late:'มาสาย',absent:'ขาด',sick:'ลาป่วย',personal:'ลากิจ',other:'อื่น ๆ'};
 return '<div class="table-scroll"><table class="data"><thead><tr><th>เลขที่</th><th>นักเรียน</th><th>สถานะ</th></tr></thead><tbody>'+
 list.map(st=>{
 const old=S.periodRows.find(x=>x.student_id===st.id&&x.session_id===S.sessionId);
 return '<tr><td>'+h(st.student_no)+'</td><td>'+h(st.full_name)+'</td><td><select class="in attendance-status" data-student="'+h(st.id)+'">'+
 '<option value="">ยังไม่เช็ค</option>'+Object.entries(labels).map(([key,label])=>'<option value="'+key+'"'+(old?.status===key?' selected':'')+'>'+label+'</option>').join('')+'</select></td></tr>';
 }).join('')+'</tbody></table></div>';
}
function sessionModal(){
 if(!currentSection())return;
 editor('เพิ่มคาบเรียน',option('session_date','วันที่สอน',today(),'date','required')+
 option('period_no','คาบที่',1,'number','min="1" max="20" required')+
 option('topic','หัวข้อที่สอน','','text','maxlength="250"')+
 option('minutes','นาที',60,'number','min="1" max="240" required')+
 tick('is_held','สอนจริงและนำไปคิดเวลาเรียน',true),async f=>{
 const v={section_id:S.courseId,session_date:f.get('session_date'),period_no:Number(f.get('period_no')),
 topic:f.get('topic'),minutes:Number(f.get('minutes')),is_held:f.has('is_held')};
 const {data,error}=await db.from('teaching_sessions').insert(v).select('id').single();
 if(error)throw error;S.sessionId=data.id;await loadSessions();draw();
 });
}
async function loadSessions(){
 S.sessions=await query('teaching_sessions');
 S.periodRows=await query('period_attendance');
 if(!S.sessions.some(x=>x.id===S.sessionId&&x.section_id===S.courseId))S.sessionId='';
}
async function markAll(){
 if(!S.sessionId)return;
 const ids=classStudents().filter(x=>!S.periodRows.some(r=>r.session_id===S.sessionId&&r.student_id===x.id));
 if(!ids.length)return note('เช็คชื่อครบแล้ว');
 const {error}=await db.from('period_attendance').upsert(ids.map(x=>({session_id:S.sessionId,student_id:x.id,status:'present'})),{onConflict:'session_id,student_id'});
 if(error)throw error;await loadSessions();draw();note('เช็คชื่อผู้ที่ยังไม่บันทึกเป็นมาเรียน '+ids.length+' คน');
}
function taskPage(){
 if(!currentSection()){$('view').innerHTML=chooseCourse();return;}
 const list=S.tasks.filter(t=>t.section_id===S.courseId).sort((a,b)=>b.created_at.localeCompare(a.created_at));
 $('view').innerHTML=chooseCourse()+'<div class="panel">'+head('ใบงาน การบ้าน และการตรวจงาน',btn('add-task','+ มอบหมายงาน','','primary'))+
 '<p class="muted">นักเรียนที่เชื่อมบัญชีแล้วสามารถส่งข้อความและไฟล์งานผ่านพอร์ทัลนักเรียน ครูตรวจงานและให้คะแนนรายบุคคลได้</p>'+
 (list.length?list.map(t=>item(t.title,'กำหนดส่ง '+(t.due_at?dateTH(t.due_at):'ไม่กำหนด')+' · คะแนนเต็ม '+t.max_score+' · '+(t.is_published?'เปิดให้นักเรียนเห็น':'ฉบับร่าง'),
 btn('view-task','ตรวจงาน',t.id,'primary')+btn('edit-task','แก้ไข',t.id)+btn('delete-task','ลบ',t.id,'danger'))).join(''):'<p class="tip">ยังไม่มีงานที่มอบหมาย</p>')+'</div>'+
 (S.taskId?renderTaskSubmissions():'');
}
function renderTaskSubmissions(){
 const t=S.tasks.find(x=>x.id===S.taskId);if(!t)return '';
 const mine=S.submissions.filter(x=>x.task_id===t.id);
 const rows=classStudents().map(st=>{
 const submission=mine.find(x=>x.student_id===st.id);
 const review=S.reviews.find(x=>x.submission_id===submission?.id);
 return '<tr><td>'+h(st.student_no)+'</td><td>'+h(st.full_name)+'</td><td>'+ (submission?'ส่งแล้ว '+dateTH(submission.submitted_at):'ยังไม่ส่ง')+'</td><td>'+
 (submission?(submission.file_path?'<a href="#" data-action="download-submission" data-id="'+h(submission.id)+'">ดาวน์โหลดไฟล์</a>':'')+
 '<p class="muted">'+h(submission.note)+'</p>':'-')+'</td><td>'+h(review?.status||'รอตรวจ')+'</td><td>'+
 (review?.score??'-')+'</td><td>'+(submission?btn('review-submission','ตรวจงาน',submission.id,'primary'):'')+'</td></tr>';
 }).join('');
 return '<div class="panel">'+head('สถานะส่งงาน: '+t.title,btn('task-csv','ส่งออก CSV'))+
 '<div class="table-scroll"><table class="data"><thead><tr><th>เลขที่</th><th>ชื่อ</th><th>สถานะส่ง</th><th>งาน</th><th>ผลตรวจ</th><th>คะแนน</th><th>จัดการ</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>';
}
function taskModal(id){
 if(!currentSection())return;
 const x=S.tasks.find(y=>y.id===id)||{};
 editor(id?'แก้ไขงาน':'มอบหมายงาน',
 option('title','ชื่อใบงาน/การบ้าน',x.title||'','text','maxlength="250" required')+
 area('instructions','คำชี้แจง',x.instructions||'')+
 option('resource_url','ลิงก์ใบงาน HTTPS (ถ้ามี)',x.resource_url||'','url')+
 option('due_at','กำหนดส่ง',x.due_at?x.due_at.slice(0,16):'','datetime-local')+
 option('max_score','คะแนนเต็ม',x.max_score??10,'number','min="0.01" max="10000" step="0.01" required')+
 tick('is_published','เผยแพร่ให้นักเรียน',x.is_published??false)+
 tick('allow_resubmit','อนุญาตให้ส่งใหม่ได้',x.allow_resubmit??true),async f=>{
 const value={section_id:S.courseId,title:String(f.get('title')).trim(),instructions:String(f.get('instructions')||''),
 resource_url:String(f.get('resource_url')||''),due_at:f.get('due_at')?new Date(String(f.get('due_at'))).toISOString():null,
 max_score:Number(f.get('max_score')),is_published:f.has('is_published'),allow_resubmit:f.has('allow_resubmit')};
 await write('assignment_tasks',value,id);await loadTasks();draw();
 });
}
async function loadTasks(){
 S.tasks=await query('assignment_tasks');S.submissions=await query('assignment_submissions');
 S.reviews=await query('assignment_reviews');
}
function reviewModal(id){
 const sub=S.submissions.find(x=>x.id===id),t=S.tasks.find(x=>x.id===sub?.task_id),old=S.reviews.find(x=>x.submission_id===id);
 if(!sub||!t)return;
 editor('ตรวจงาน · '+name(S.students,sub.student_id,'full_name'),
 option('score','คะแนน (ไม่เกิน '+t.max_score+')',old?.score??'','number','min="0" max="'+t.max_score+'" step="0.01"')+
 area('feedback','ความคิดเห็นครู',old?.feedback||'')+
 '<label>ผลการตรวจ<select class="in" name="status"><option value="pending">รอตรวจ</option><option value="graded"'+(old?.status==='graded'?' selected':'')+'>ตรวจแล้ว</option><option value="revision"'+(old?.status==='revision'?' selected':'')+'>ต้องแก้ไข</option></select></label>',async f=>{
 const score=f.get('score')===''?null:Number(f.get('score'));
 if(score!==null&&(!Number.isFinite(score)||score<0||score>Number(t.max_score)))throw Error('คะแนนเกินคะแนนเต็ม');
 const v={submission_id:id,score,feedback:String(f.get('feedback')||''),status:String(f.get('status')),reviewed_at:new Date().toISOString()};
 const {error}=await db.from('assignment_reviews').upsert(v,{onConflict:'submission_id'});
 if(error)throw error;await loadTasks();draw();
 });
}
async function downloadSubmission(id){
 const sub=S.submissions.find(x=>x.id===id);if(!sub?.file_path)return;
 const {data,error}=await db.storage.from('student-uploads').createSignedUrl(sub.file_path,60);
 if(error)throw error;window.open(data.signedUrl,'_blank','noopener,noreferrer');
}
function gradesPage(){
 $('view').innerHTML='<div class="panel">'+head('สมุดคะแนนออนไลน์',btn('grade-csv','ส่งออก CSV'))+
 '<p class="tip">คะแนนจากกิจกรรมประเมินและการตรวจงานใช้ฐานข้อมูลเดียวกันกับเว็บไซต์หลัก โดยเมนูนี้แสดงผลสรุปจากข้อมูลจริง</p>'+
 '<p><a class="act primary" href="./">เปิดเว็บไซต์หลัก → เข้าสู่ระบบครู → ประเมินและบันทึกคะแนน</a></p>'+
 '<div class="table-scroll"><table class="data"><thead><tr><th>ชั้นเรียน</th><th>กิจกรรม</th><th>รายวิชา</th><th>คะแนนเต็ม</th></tr></thead><tbody>'+
 S.assessments.map(a=>'<tr><td>'+h(name(S.classes,a.class_id))+'</td><td>'+h(a.title)+'</td><td>'+h(name(S.subjects,a.subject_id))+'</td><td>'+a.max_score+'</td></tr>').join('')+'</tbody></table></div>'+
 '<p class="muted">คะแนนรายบุคคลดูได้จากระบบหลังบ้านเดิม โดยนักเรียนที่เชื่อมบัญชีเห็นเฉพาะคะแนนของตนเอง</p></div>';
}
function paPage(){
 if(!S.admin){$('view').innerHTML='<div class="panel"><p class="error">เฉพาะ Admin เท่านั้นที่เข้าถึงแฟ้ม วPA ได้</p></div>';return;}
 const cycle=S.paCycles.sort((a,b)=>b.fiscal_year-a.fiscal_year)[0];
 const counted=new Set(S.evidence.filter(e=>e.cycle_id===cycle?.id&&e.indicator_id).map(e=>e.indicator_id));
 const pc=cycle?Math.round(100*counted.size/Math.max(S.indicators.length,1)):0;
 $('view').innerHTML='<div class="panel">'+head('แฟ้มข้อตกลงในการพัฒนางาน (วPA)',btn('add-evidence','+ เพิ่มหลักฐาน','','primary'))+
 '<p class="muted">ข้อมูลส่วนนี้เป็นข้อมูลส่วนตัวของผู้ดูแล ยังไม่เปิดเผยแก่ผู้เยี่ยมชมเว็บไซต์</p>'+
 '<div class="toolbar">'+(cycle?'<span class="pill">ปีงบประมาณ พ.ศ. '+h(cycle.fiscal_year)+'</span>'+btn('edit-pa','แก้ไขประเด็นท้าทาย',cycle.id):btn('add-pa','+ เพิ่มปีงบประมาณ'))+'</div>'+
 '<p>ความครบถ้วนของหลักฐาน (นับตัวชี้วัดที่มีหลักฐานอย่างน้อย 1 รายการ): <strong>'+counted.size+' / '+S.indicators.length+' ตัวชี้วัด</strong> · '+pc+'%</p>'+
 '<div class="progress"><div class="bar" style="width:'+pc+'%"></div></div>'+
 (cycle?.challenge_title?'<p><strong>ประเด็นท้าทาย:</strong> '+h(cycle.challenge_title)+'</p>':'')+'</div>'+
 '<div class="split">'+[1,2,3].map(area=>{
 const filtered=S.indicators.filter(x=>x.area_no===area);
 return '<div class="panel"><h2>ด้านที่ '+area+' · '+({1:'จัดการเรียนรู้',2:'ส่งเสริมและสนับสนุน',3:'พัฒนาตนเองและวิชาชีพ'}[area])+'</h2>'+
 filtered.map(i=>item(i.code+' '+i.title,
 'หลักฐาน '+S.evidence.filter(e=>e.indicator_id===i.id&&e.cycle_id===cycle?.id).length+' รายการ',
 btn('add-evidence-for','+ แนบหลักฐาน',i.id))).join('')+'</div>';
 }).join('')+'</div>'+
 '<div class="panel">'+head('รายการหลักฐาน')+
 (S.evidence.filter(e=>e.cycle_id===cycle?.id).length?S.evidence.filter(e=>e.cycle_id===cycle?.id).map(e=>item(e.title,
 (S.indicators.find(i=>i.id===e.indicator_id)?.code||'ทั่วไป')+' · '+dateTH(e.evidence_date)+' · '+e.description,
 (e.evidence_url?'<a class="act" target="_blank" rel="noopener noreferrer" href="'+safeLink(e.evidence_url)+'">เปิดหลักฐาน</a>':'')+
 btn('edit-evidence','แก้ไข',e.id)+btn('delete-evidence','ลบ',e.id,'danger'))).join(''):'<p class="muted">ยังไม่มีหลักฐาน</p>')+'</div>';
}
function paCycleModal(id){
 const x=S.paCycles.find(a=>a.id===id)||{};
 editor(id?'แก้ไขประเด็นท้าทาย':'เพิ่มปีงบประมาณ',
 option('fiscal_year','ปีงบประมาณ (พ.ศ.)',x.fiscal_year||2570,'number','min="2500" max="2700" required')+
 option('starts_on','เริ่มต้น',x.starts_on||'2026-10-01','date','required')+
 option('ends_on','สิ้นสุด',x.ends_on||'2027-09-30','date','required')+
 option('challenge_title','ชื่อประเด็นท้าทาย',x.challenge_title||'','text')+
 area('challenge_description','สภาพปัญหา/วิธีดำเนินการ/เป้าหมาย',x.challenge_description||''),async f=>{
 await write('pa_cycles',{fiscal_year:Number(f.get('fiscal_year')),starts_on:f.get('starts_on'),ends_on:f.get('ends_on'),
 challenge_title:String(f.get('challenge_title')||''),challenge_description:String(f.get('challenge_description')||'')},id);
 await loadAll();draw();
 });
}
function evidenceModal(id,indicatorId){
 const x=S.evidence.find(a=>a.id===id)||{},cycle=S.paCycles.slice().sort((a,b)=>b.fiscal_year-a.fiscal_year)[0];
 if(!cycle)return note('สร้างปีงบประมาณก่อน',true);
 editor(id?'แก้ไขหลักฐาน':'เพิ่มหลักฐาน วPA',
 choose('indicator_id','ตัวชี้วัด',S.indicators.map(x=>({...x,name:x.code+' '+x.title})),x.indicator_id||indicatorId||S.indicators[0]?.id)+
 option('title','ชื่อหลักฐาน',x.title||'','text','maxlength="250" required')+
 area('description','คำอธิบาย/ผลลัพธ์',x.description||'')+
 option('evidence_url','ลิงก์หลักฐาน HTTPS',x.evidence_url||'','url')+
 option('evidence_date','วันที่หลักฐาน',x.evidence_date||today(),'date','required'),async f=>{
 await write('pa_evidence',{cycle_id:cycle.id,indicator_id:f.get('indicator_id'),title:String(f.get('title')||'').trim(),
 description:String(f.get('description')||''),evidence_url:String(f.get('evidence_url')||''),evidence_date:f.get('evidence_date')},id);
 await loadAll();draw();
 });
}
function portfolioPage(){
 if(!S.admin){$('view').innerHTML='<div class="panel"><p class="error">เฉพาะ Admin ที่จัดการผลงานได้</p></div>';return;}
 const categories={photo:'ภาพกิจกรรม',video:'วิดีโอ',certificate:'เกียรติบัตร',award:'รางวัล',research:'งานวิจัย',innovation:'นวัตกรรม',training:'การอบรม',other:'อื่น ๆ'};
 $('view').innerHTML='<div class="panel">'+head('ผลงาน เกียรติบัตร ภาพกิจกรรม และวิดีโอ',btn('add-portfolio','+ เพิ่มรายการ','','primary'))+
 '<p class="muted">เผยแพร่เฉพาะรายการที่ได้รับอนุญาต หากมีภาพนักเรียนให้ตรวจสอบสิทธิ์เผยแพร่และ PDPA ก่อน</p>'+
 '<p><a href="./portfolio.html" target="_blank" rel="noopener noreferrer">เปิดหน้ารวมผลงานสาธารณะ ↗</a></p>'+
 (S.portfolio.length?S.portfolio.map(x=>item(x.title,
 (categories[x.category]||x.category)+' · '+dateTH(x.event_date)+' · '+(x.is_published?'เผยแพร่แล้ว':'ฉบับร่าง'),
 (x.link_url?'<a class="act" href="'+safeLink(x.link_url)+'" rel="noopener noreferrer" target="_blank">ลิงก์ผลงาน</a>':'')+
 btn('edit-portfolio','แก้ไข',x.id)+btn('delete-portfolio','ลบ',x.id,'danger'))).join(''):'<p class="tip">ยังไม่มีรายการผลงาน เพิ่มรายการแรกได้จากปุ่มด้านบน</p>')+'</div>';
}
function portfolioModal(id){
 const x=S.portfolio.find(a=>a.id===id)||{};
 const labels=[['photo','ภาพกิจกรรม'],['video','วิดีโอ'],['certificate','เกียรติบัตร'],['award','รางวัล'],['research','งานวิจัย'],['innovation','นวัตกรรม'],['training','การอบรม'],['other','อื่น ๆ']];
 editor(id?'แก้ไขผลงาน':'เพิ่มผลงาน',
 '<label>หมวดหมู่<select class="in" name="category">'+labels.map(a=>'<option value="'+a[0]+'"'+(a[0]===x.category?' selected':'')+'>'+a[1]+'</option>').join('')+'</select></label>'+
 option('title','ชื่อกิจกรรม/ผลงาน',x.title||'','text','maxlength="250" required')+
 area('description','รายละเอียดและหน่วยงานที่มอบ',x.description||'')+
 option('event_date','วันที่ผลงาน',x.event_date||today(),'date')+
 option('image_url','ลิงก์ภาพหน้าปก HTTPS',x.image_url||'','url')+
 option('link_url','ลิงก์รายละเอียด YouTube / Google Drive / PDF',x.link_url||'','url')+
 tick('is_published','เผยแพร่ให้ผู้เยี่ยมชมเห็น',x.is_published),async f=>{
 const urls=['image_url','link_url'];for(const k of urls){const u=String(f.get(k)||'');if(u&&!u.startsWith('https://'))throw Error('ลิงก์ต้องใช้ HTTPS');}
 await write('teacher_portfolio',{category:f.get('category'),title:String(f.get('title')).trim(),description:String(f.get('description')||''),
 event_date:f.get('event_date')||null,image_url:String(f.get('image_url')||''),link_url:String(f.get('link_url')||''),is_published:f.has('is_published')},id);
 await loadAll();draw();
 });
}
function csv(rows,file){
 const quote=s=>'"'+String(s??'').replace(/"/g,'""').replace(/^\s*([=+@\-\t\r])/,'\u0027$1')+'"';
 const blob=new Blob(['\uFEFF'+rows.map(r=>r.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=file;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function draw(){
 $('tabs').querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab===S.tab));
 if(S.tab==='overview')overview();
 if(S.tab==='courses')courses();
 if(S.tab==='sessions')sessionPage();
 if(S.tab==='tasks')taskPage();
 if(S.tab==='grades')gradesPage();
 if(S.tab==='students')studentPage();
 if(S.tab==='pa')paPage();
 if(S.tab==='portfolio')portfolioPage();
}
async function toTab(tab){
 S.tab=tab;
 if(tab==='courses')await refreshCourse();
 if(tab==='sessions')await loadSessions();
 if(tab==='tasks')await loadTasks();
 if(tab==='grades')S.assessments=await query('assessments');
 draw();
}
async function runAction(action,id){
 if(S.busy)return;
 if(action.startsWith('go-'))return toTab(action.slice(3));
 if(action==='add-class')return classModal();
 if(action==='add-term')return termModal();
 if(action==='add-course'||action==='edit-course')return courseModal(id);
 if(action==='open-course'){S.courseId=id;await refreshCourse();draw();return;}
 if(action==='delete-course'){if(confirm('ลบการเปิดสอนรายวิชานี้ และข้อมูลคาบเรียน/งานที่เชื่อมโยงหรือไม่?')){await del('course_sections',id);await loadAll();await refreshCourse();draw();}return;}
 if(action==='add-unit'||action==='edit-unit')return unitModal(id);
 if(action==='delete-unit'){if(confirm('ลบหน่วยการเรียนรู้นี้?')){await del('course_units',id);await refreshCourse();draw();}return;}
 if(action==='add-student'||action==='edit-student')return studentModal(id);
 if(action==='link-student')return linkStudent();
 if(action==='add-session')return sessionModal();
 if(action==='delete-session'){if(confirm('ลบคาบเรียนและข้อมูลเช็คชื่อคาบนี้?')){await del('teaching_sessions',id);S.sessionId='';await loadSessions();draw();}return;}
 if(action==='mark-all')return markAll();
 if(action==='attendance-csv'){
  const held=S.sessions.filter(x=>x.section_id===S.courseId&&x.is_held);
  const rows=[['เลขที่','ชื่อ-นามสกุล','จำนวนคาบ','เวลาเรียนร้อยละ']];
  for(const st of classStudents()){
   const statuses=S.periodRows.filter(x=>x.student_id===st.id&&held.some(k=>k.id===x.session_id));
   const weighted=statuses.reduce((sum,x)=>sum+(['present'].includes(x.status)?1:x.status==='late'?Number(currentSection().late_weight):['sick','personal'].includes(x.status)?Number(currentSection().leave_weight):0),0);
   rows.push([st.student_no,st.full_name,held.length,held.length?(weighted/held.length*100).toFixed(2):'']);
  }
  return csv(rows,'เวลาเรียนรายวิชา.csv');
 }
 if(action==='add-task'||action==='edit-task')return taskModal(id);
 if(action==='delete-task'){if(confirm('ลบงานนี้และผลการส่งงานทั้งหมด?')){await del('assignment_tasks',id);S.taskId='';await loadTasks();draw();}return;}
 if(action==='view-task'){S.taskId=id;await loadTasks();draw();return;}
 if(action==='review-submission')return reviewModal(id);
 if(action==='download-submission')return downloadSubmission(id);
 if(action==='task-csv'){
  const t=S.tasks.find(x=>x.id===S.taskId);if(!t)return;
  return csv([['เลขที่','ชื่อ','ส่งงาน','คะแนน','ผลตรวจ'],...classStudents().map(st=>{
   const sub=S.submissions.find(x=>x.task_id===t.id&&x.student_id===st.id);
   const rev=S.reviews.find(x=>x.submission_id===sub?.id);
   return [st.student_no,st.full_name,sub?'ส่งแล้ว':'ยังไม่ส่ง',rev?.score??'',rev?.status||'รอตรวจ'];
  })],'สถานะส่งงาน.csv');
 }
 if(action==='grade-csv')return csv([['ชั้นเรียน','รายการประเมิน','คะแนนเต็ม'],...S.assessments.map(a=>[name(S.classes,a.class_id),a.title,a.max_score])],'รายการประเมิน.csv');
 if(action==='add-pa'||action==='edit-pa')return paCycleModal(id);
 if(action==='add-evidence'||action==='edit-evidence')return evidenceModal(id);
 if(action==='add-evidence-for')return evidenceModal(null,id);
 if(action==='delete-evidence'){if(confirm('ลบหลักฐานนี้?')){await del('pa_evidence',id);await loadAll();draw();}return;}
 if(action==='add-portfolio'||action==='edit-portfolio')return portfolioModal(id);
 if(action==='delete-portfolio'){if(confirm('ลบรายการผลงานนี้?')){await del('teacher_portfolio',id);await loadAll();draw();}return;}
}
async function init(){
 try{
 const {data}=await db.auth.getUser();S.user=data?.user;
 if(!S.user){$('loginArea').hidden=false;$('who').textContent='กรุณาเข้าสู่ระบบ';return;}
 const {data:profile,error}=await db.from('profiles').select('id,full_name,role').eq('id',S.user.id).single();
 if(error)throw error;S.profile=profile;S.admin=profile.role==='admin';
 // Student accounts use their own dashboard, never the staff management panel.
 const {data:student}=await db.from('student_accounts').select('student_id').eq('user_id',S.user.id).maybeSingle();
 if(student&&!S.admin){location.replace('./student.html');return;}
 $('who').textContent=profile.full_name||S.user.email;$('signOut').hidden=false;
 $('studioArea').hidden=false;
 if(!S.admin){$('tabs').querySelectorAll('[data-tab="pa"],[data-tab="portfolio"]').forEach(x=>x.hidden=true);}
 await loadAll();await toTab('overview');
 }catch(e){$('loginArea').hidden=false;note('โหลดข้อมูลไม่ได้: '+errorMessage(e),true);$('who').textContent='เชื่อมต่อไม่ได้';}
}
$('tabs').addEventListener('click',e=>{
 const b=e.target.closest('[data-tab]');if(!b)return;
 toTab(b.dataset.tab).catch(e=>note(errorMessage(e),true));
});
$('view').addEventListener('click',e=>{
 const b=e.target.closest('[data-action]');if(!b)return;
 e.preventDefault();runAction(b.dataset.action,b.dataset.id).catch(x=>note(errorMessage(x),true));
});
$('view').addEventListener('change',async e=>{
 try{
 if(e.target.id==='coursePicker'){S.courseId=e.target.value;S.sessionId='';S.taskId='';if(S.tab==='sessions')await loadSessions();else if(S.tab==='tasks')await loadTasks();else await refreshCourse();draw();}
 if(e.target.id==='sessionPicker'){S.sessionId=e.target.value;draw();}
 if(e.target.classList.contains('attendance-status')){
  const student_id=e.target.dataset.student,status=e.target.value;
  if(status){const {error}=await db.from('period_attendance').upsert({session_id:S.sessionId,student_id,status},{onConflict:'session_id,student_id'});if(error)throw error;}
  else{const {error}=await db.from('period_attendance').delete().eq('session_id',S.sessionId).eq('student_id',student_id);if(error)throw error;}
  await loadSessions();draw();
 }
 }catch(err){note(errorMessage(err),true);}
});
$('editForm').addEventListener('submit',async e=>{
 e.preventDefault();if(S.busy||!S.save)return;
 S.busy=true;$('saveEditor').disabled=true;$('editorError').hidden=true;
 try{await S.save(new FormData(e.target));$('editor').close();note('บันทึกข้อมูลเรียบร้อย');}
 catch(err){$('editorError').textContent=errorMessage(err);$('editorError').hidden=false;}
 finally{S.busy=false;$('saveEditor').disabled=false;}
});
$('cancelEditor').addEventListener('click',()=>{$('editor').close();S.save=null;});
$('signOut').addEventListener('click',async()=>{await db.auth.signOut();location.href='./';});
$('loginForm').addEventListener('submit',async e=>{
 e.preventDefault();const f=new FormData(e.target);
 const {error}=await db.auth.signInWithPassword({email:String(f.get('email')).trim(),password:String(f.get('password'))});
 if(error){$('loginError').textContent=errorMessage(error);$('loginError').hidden=false;return;}
 $('loginError').hidden=true;$('loginArea').hidden=true;await init();
});
init();