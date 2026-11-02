import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const cfg = window.APP_CONFIG || {};
const ENDPOINT = String(cfg.supabaseUrl || '').trim();
const PUBLIC_KEY = String(cfg.publishableKey || '').trim();
const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(ENDPOINT) && PUBLIC_KEY.length > 30;
const db = configured ? createClient(ENDPOINT, PUBLIC_KEY, {auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:false}}) : null;
const $ = id => document.getElementById(id);
const STATUSES = {present:'มาเรียน',absent:'ขาดเรียน',late:'มาสาย',sick:'ลาป่วย',personal:'ลากิจ'};
const CATEGORIES = {worksheet:'ใบงาน',quiz:'แบบทดสอบ',assignment:'ชิ้นงาน',activity:'กิจกรรม',other:'อื่น ๆ'};
const ADMIN_TITLES = {overview:'ภาพรวม',attendance:'เช็คชื่อนักเรียน',students:'รายชื่อนักเรียน',assessments:'ประเมินและบันทึกคะแนน',worksheets:'จัดการใบงาน',subjects:'จัดการรายวิชา',announcements:'จัดการประกาศ',settings:'ตั้งค่าเว็บไซต์'};
const s = {
  view:'home', tab:'overview', user:null,profile:null,
  site:{site_title:'ห้องเรียนดิจิทัล',teacher_name:'ครูเนติพงษ์ มาตนาเรียง',tagline:'เรียนรู้ สนุกคิด และเติบโตไปด้วยกัน',introduction:'พื้นที่รวมสื่อการเรียนรู้ ใบงาน และกิจกรรมวิทยาการคำนวณ',subject:'วิทยาศาสตร์และเทคโนโลยี · วิทยาการคำนวณ'},
  publicWorksheets:[],publicAnnouncements:[],publicSubjects:[],publicSubjectFilter:'all',
  classes:[],students:[],assessments:[],worksheets:[],subjects:[],announcements:[],
  attendance:[],assessmentScores:[],currentAssessment:null,
  classId:'',studentClass:'all',studentSearch:'',attDate:isoLocal(new Date()),
  busy:false
};
const h = x => String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeAttr=h;
const fmt=n=>Number(n||0).toLocaleString('th-TH');
const admin=()=>s.profile?.role==='admin';
function isoLocal(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function thDate(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v||''))return h(v);const a=v.split('-').map(Number);return new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short',year:'numeric'}).format(new Date(a[0],a[1]-1,a[2]));}
function eMsg(e){if(!e)return 'เกิดข้อผิดพลาด';if(e.code==='23505')return 'มีข้อมูลซ้ำอยู่แล้ว';if(e.code==='42501')return 'ไม่มีสิทธิ์ดำเนินการ';if(e.code==='23503')return 'รายการนี้มีข้อมูลอ้างอิงอยู่';return e.message||'ไม่สามารถดำเนินการได้';}
let toastTimer;
function toast(t,bad=false){const el=$('toast');el.textContent=t;el.className='toast'+(bad?' error':'');el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,5000);}
function busy(v){s.busy=v;document.querySelectorAll('button[type=submit]').forEach(x=>x.disabled=v);}
function className(id){return s.classes.find(c=>c.id===id)?.name || '-';}
function adminOptions(selected,allowAll=false){
 return (allowAll?'<option value="all"'+(selected==='all'?' selected':'')+'>ทุกชั้นเรียน</option>':'')+
  s.classes.map(c=>'<option value="'+h(c.id)+'"'+(selected===c.id?' selected':'')+'>'+h(c.name)+'</option>').join('');
}
function empty(title,body){return '<div class="empty-message"><strong>'+h(title)+'</strong>'+h(body||'')+'</div>';}
function smallButton(action,text,style='outline',attrs=''){return '<button type="button" class="button button-'+style+' button-small" data-action="'+h(action)+'" '+attrs+'>'+h(text)+'</button>';}
function stat(label,value,subtitle){return '<article class="stat-card"><span>'+h(label)+'</span><strong>'+fmt(value)+'</strong><small>'+h(subtitle||'')+'</small></article>';}
function safeUrl(v){try{const u=new URL(v);return u.protocol==='https:'?u.href:'#';}catch{return '#';}}
async function allRows(table,cols,sort,filter){
 let out=[];
 for(let start=0;start<50000;start+=500){
  let q=db.from(table).select(cols).order(sort,{ascending:true}).range(start,start+499);
  if(filter)q=filter(q);
  const {data,error}=await q;if(error)throw error;
  out.push(...(data||[]));if((data||[]).length<500)break;
 }
 return out;
}
async function refreshPublic(){
 if(!db)return;
 const [site,works,ann,subjects]=await Promise.all([
  db.from('teacher_site').select('site_title,teacher_name,tagline,introduction,subject').eq('id',1).single(),
  db.from('worksheets').select('id,title,description,subject,subject_id,grade_label,file_path,external_url,created_at').eq('is_published',true).order('created_at',{ascending:false}).limit(100),
  db.from('teacher_announcements').select('id,title,body,created_at').eq('is_published',true).order('created_at',{ascending:false}).limit(40),
   db.from('teacher_subjects').select('id,name,subject_code,description,is_active,sort_order').eq('is_active',true).order('sort_order').order('name')
 ]);
 if(site.error)throw site.error;if(works.error)throw works.error;if(ann.error)throw ann.error;if(subjects.error)throw subjects.error;
 s.site=site.data;s.publicWorksheets=works.data||[];s.publicAnnouncements=ann.data||[];s.publicSubjects=subjects.data||[];
 if(s.publicSubjectFilter!=='all'&&!s.publicSubjects.some(x=>x.id===s.publicSubjectFilter))s.publicSubjectFilter='all';
 document.title=s.site.site_title+' | '+s.site.teacher_name;
 $('brandTitle').textContent=s.site.site_title;
}
function worksheetLink(w){
 if(w.external_url)return safeUrl(w.external_url);
 if(w.file_path){const {data}=db.storage.from('teacher-worksheets').getPublicUrl(w.file_path);return safeUrl(data.publicUrl);}
 return '#';
}
function subjectById(id){return s.subjects.find(x=>x.id===id)||s.publicSubjects.find(x=>x.id===id);}
function subjectName(w){return subjectById(w.subject_id)?.name||w.subject||'ทั่วไป';}
function subjectOptions(value='',blank=true){
 const source=admin()?s.subjects:s.publicSubjects;
 return (blank?[['','ไม่ระบุรายวิชา']]:[]).concat(source.filter(x=>x.is_active||x.id===value).map(x=>[x.id,x.name+(x.subject_code?' ('+x.subject_code+')':'')+(x.is_active?'':' · ปิดแสดง')]));
}
function publicSubjects(){
 return '<section class="section"><div class="public-container"><div class="section-head"><div><span class="eyebrow">OUR SUBJECTS</span><h2>รายวิชาทั้งหมด</h2><p class="muted">เลือกรายวิชาเพื่อดูใบงานและเอกสาร</p></div></div><div class="features">'+
 (s.publicSubjects.length?s.publicSubjects.map(x=>'<article class="feature-card"><div class="feature-icon">◈</div><h3>'+h(x.name)+'</h3>'+
 '<p>'+h(x.description||'เรียนรู้ผ่านกิจกรรมและสื่อออนไลน์')+'</p>'+
 (x.subject_code?'<span class="tag">'+h(x.subject_code)+'</span>':'')+
 '<p><button class="button button-outline button-small" data-action="open-subject" data-id="'+h(x.id)+'">ดูใบงาน →</button></p></article>').join(''):empty('ยังไม่มีรายวิชา','กรุณาติดต่อผู้ดูแลเว็บไซต์'))+
 '</div></div></section>';
}
function worksheetCard(w){
 const url=worksheetLink(w);
 return '<article class="resource-card"><div class="resource-image">▤</div><div class="meta"><span class="tag">'+h(w.grade_label||'ทุกระดับ')+'</span><span class="tag green">'+h(subjectName(w))+'</span></div>'+
 '<h3>'+h(w.title)+'</h3><p>'+h(w.description||'เอกสารประกอบการเรียนรู้สำหรับนักเรียน')+'</p>'+
 '<a class="button button-outline button-small" target="_blank" rel="noopener noreferrer" href="'+safeAttr(url)+'">↓ เปิดใบงาน / ดาวน์โหลด</a></article>';
}
function publicHome(){
 const list=s.publicWorksheets.slice(0,3),news=s.publicAnnouncements.slice(0,3);
 return '<section class="hero"><div class="public-container hero-grid"><div class="hero-copy">'+
  '<div class="badge-hero">✦ DIGITAL LEARNING CLASSROOM</div>'+
  '<h1>ยินดีต้อนรับสู่<br><em>'+h(s.site.site_title)+'</em></h1>'+
  '<h2 style="font-size:19px;color:#f4faff;margin-bottom:15px">'+h(s.site.teacher_name)+'</h2>'+
  '<p>'+h(s.site.tagline)+'<br>'+h(s.site.introduction)+'</p>'+
  '<div class="hero-actions"><button class="button button-primary" data-view="worksheets">▤ สำรวจใบงาน</button>'+
  '<button class="button button-glass" data-view="about">รู้จักคุณครู ↗</button></div></div>'+
  '<div class="hero-graphic"><div class="graphic-glow"></div><div class="hero-orbit"><div class="hero-icon">⌘</div></div>'+
  '<div class="float-chip chip-1">◈ วิทยาการคำนวณ<small>Computing Science</small></div>'+
  '<div class="float-chip chip-2">✓ เรียนรู้ได้ทุกที่<small>Digital Learning</small></div>'+
  '<div class="float-chip chip-3">✦ สร้างสรรค์ด้วย AI<small>Future Skills</small></div></div></div></section>'+
  '<section class="section"><div class="public-container"><div class="section-title"><span class="eyebrow">OUR LEARNING ZONE</span><h2>พื้นที่แห่งการเรียนรู้</h2><p>เสริมทักษะการคิด วิเคราะห์ ลงมือทำ และสร้างสรรค์</p></div>'+
  '<div class="features">'+[
   ['◈','วิทยาการคำนวณ','ฝึกคิดอย่างเป็นขั้นตอนและแก้ปัญหาเชิงระบบ'],
   ['⌘','การเขียนโปรแกรม','เรียนรู้ Coding และอัลกอริทึมผ่านกิจกรรม'],
   ['▤','ใบงานและแบบฝึก','ดาวน์โหลดใบงานเพื่อฝึกทักษะทบทวนความรู้'],
   ['✦','AI และเทคโนโลยี','สร้างสรรค์ผลงานและเรียนรู้เทคโนโลยีอนาคต']
  ].map(a=>'<div class="feature-card"><div class="feature-icon">'+a[0]+'</div><h3>'+a[1]+'</h3><p>'+a[2]+'</p></div>').join('')+'</div></div></section>'+
  '<section class="section"><div class="public-container"><div class="section-head"><div><span class="eyebrow">SUBJECTS</span><h2>รายวิชาที่เปิดสอน</h2></div><button class="button button-outline" data-view="subjects">ดูรายวิชาทั้งหมด →</button></div><div class="features">'+
   (s.publicSubjects.length?s.publicSubjects.slice(0,4).map(x=>'<article class="feature-card"><div class="feature-icon">◈</div><h3>'+h(x.name)+'</h3><p>'+h(x.description||x.subject_code||'กิจกรรมการเรียนรู้')+'</p><button class="button button-outline button-small" data-action="open-subject" data-id="'+h(x.id)+'">ดูใบงาน →</button></article>').join(''):empty('ยังไม่มีรายวิชา','ผู้ดูแลสามารถเพิ่มรายวิชาได้จากหลังบ้าน'))+'</div></div></section>'+
   '<section class="section section-soft"><div class="public-container"><div class="section-head"><div><span class="eyebrow">LEARNING RESOURCES</span><h2>ใบงานล่าสุด</h2><p class="muted">สื่อการเรียนรู้ที่เปิดให้นักเรียนใช้งาน</p></div>'+
  '<button class="button button-outline" data-view="worksheets">ดูทั้งหมด →</button></div><div class="worksheets-grid">'+(list.length?list.map(worksheetCard).join(''):empty('ยังไม่มีใบงานเผยแพร่','ครูสามารถเพิ่มใบงานได้ในระบบหลังบ้าน'))+'</div></div></section>'+
  '<section class="section"><div class="public-container"><div class="section-head"><div><span class="eyebrow">UPDATES</span><h2>ข่าวสารและประกาศ</h2></div><button class="button button-outline" data-view="announcements">ดูทั้งหมด →</button></div>'+
  '<div class="news-grid">'+(news.length?news.map(newsCard).join(''):empty('ยังไม่มีข่าวสาร','ติดตามกิจกรรมและประกาศได้ที่นี่'))+'</div></div></section>';
}
function newsCard(a){return '<article class="news-card"><span class="news-date">'+h(thDate(String(a.created_at).slice(0,10)))+'</span><h3>'+h(a.title)+'</h3><p>'+h(a.body)+'</p></article>';}
function publicWorksheets(){
 const list=s.publicSubjectFilter==='all'?s.publicWorksheets:s.publicWorksheets.filter(w=>w.subject_id===s.publicSubjectFilter);
 const choices='<option value="all"'+(s.publicSubjectFilter==='all'?' selected':'')+'>ทุกวิชา</option>'+s.publicSubjects.map(x=>'<option value="'+h(x.id)+'"'+(s.publicSubjectFilter===x.id?' selected':'')+'>'+h(x.name)+'</option>').join('');
 return '<section class="section"><div class="public-container"><div class="section-head"><div><span class="eyebrow">DOWNLOAD CENTER</span><h2>คลังใบงานและสื่อการเรียนรู้</h2><p class="muted">เลือกเปิดหรือดาวน์โหลดเอกสารที่ครูเผยแพร่</p></div></div>'+
 '<div class="tool-row"><label class="field-inline">เลือกรายวิชา <select class="control" data-control="publicSubject">'+choices+'</select></label></div>'+
 '<div class="worksheets-grid">'+(list.length?list.map(worksheetCard).join(''):empty('ไม่มีใบงานในรายวิชานี้','ครูยังไม่ได้เผยแพร่เอกสาร'))+'</div></div></section>';
}
function publicAnnouncements(){return '<section class="section"><div class="public-container"><div class="section-head"><div><span class="eyebrow">NEWS & UPDATES</span><h2>ข่าวสารและประกาศ</h2></div></div><div class="news-grid">'+
 (s.publicAnnouncements.length?s.publicAnnouncements.map(newsCard).join(''):empty('ยังไม่มีประกาศ','อัปเดตประกาศใหม่ได้จากหลังบ้าน'))+'</div></div></section>';}
function publicAbout(){return '<section class="section"><div class="public-container"><div class="about-panel"><div class="about-symbol">✳</div><div><span class="eyebrow">ABOUT THE TEACHER</span><h2>'+h(s.site.teacher_name)+'</h2><p style="font-weight:600">'+h(s.site.subject)+'</p><p>'+h(s.site.introduction)+'</p><span class="tag">โรงเรียนบ้านหินลาด</span></div></div></div></section>';}
function setView(view){
 s.view=view;$('publicArea').hidden=false;$('authArea').hidden=true;$('dashboardArea').hidden=true;$('footer').hidden=false;
 $('authButton').textContent=s.user?'เข้าสู่หลังบ้าน':'เข้าสู่ระบบครู';
 document.querySelectorAll('.nav-btn').forEach(x=>x.classList.toggle('active',x.dataset.view===view));
 if(view==='home')$('publicContent').innerHTML=publicHome();
 if(view==='worksheets')$('publicContent').innerHTML=publicWorksheets();
 if(view==='subjects')$('publicContent').innerHTML=publicSubjects();
 if(view==='announcements')$('publicContent').innerHTML=publicAnnouncements();
 if(view==='about')$('publicContent').innerHTML=publicAbout();
 $('publicNav').classList.remove('open');window.scrollTo({top:0,behavior:'instant'});
}
function loginView(){
 if(!db)return toast('เว็บไซต์ยังไม่ได้ตั้งค่า Supabase',true);
 $('publicArea').hidden=true;$('authArea').hidden=false;$('dashboardArea').hidden=true;$('footer').hidden=true;
 $('publicNav').classList.remove('open');$('loginError').textContent='';
}
async function initSession(){
 if(!db){$('alertBanner').hidden=false;$('alertBanner').textContent='ยังไม่ได้กำหนดการเชื่อมต่อฐานข้อมูล Supabase';setView('home');return;}
 try{await refreshPublic();const {data}=await db.auth.getUser();
  if(data?.user){s.user=data.user;await loadProfile();}
 }catch(err){toast('ไม่สามารถเชื่อมต่อข้อมูล: '+eMsg(err),true);}
 setView('home');
}
async function loadProfile(){
 if(!s.user)return;
 const {data,error}=await db.from('profiles').select('id,full_name,role').eq('id',s.user.id).single();
 if(error)throw error;s.profile=data;
}
async function refreshProtected(){
 if(!s.user)throw Error('กรุณาเข้าสู่ระบบใหม่');
 if(!s.profile)await loadProfile();
 const [classes,students,assessments]=await Promise.all([
  allRows('school_classes','id,name','name'),
  allRows('students','id,class_id,student_no,full_name','id'),
  allRows('assessments','id,class_id,subject_id,title,category,max_score,assessment_date,details,is_published','assessment_date')
 ]);
 s.classes=classes;s.students=students;s.assessments=assessments;
 if(!classes.some(c=>c.id===s.classId))s.classId=classes[0]?.id||'';
 if(s.studentClass!=='all'&&!classes.some(c=>c.id===s.studentClass))s.studentClass='all';
 if(s.currentAssessment&&!assessments.some(a=>a.id===s.currentAssessment))s.currentAssessment=null;
 if(admin()){
  const [ws,an,subjects]=await Promise.all([
   allRows('worksheets','id,title,description,subject,subject_id,grade_label,file_path,external_url,is_published,created_at','created_at'),
   allRows('teacher_announcements','id,title,body,is_published,created_at','created_at'),
    allRows('teacher_subjects','id,name,subject_code,description,is_active,sort_order','sort_order')
  ]);
  s.worksheets=ws.reverse();s.announcements=an.reverse();s.subjects=subjects.sort((a,b)=>a.sort_order-b.sort_order||a.name.localeCompare(b.name,'th'));
 }
}
async function enterAdmin(){
 if(!s.user)return loginView();
 $('publicArea').hidden=true;$('authArea').hidden=true;$('dashboardArea').hidden=false;$('footer').hidden=true;
 $('profileName').textContent=s.profile?.full_name||s.user.email||'คุณครู';
 $('profileRole').textContent=admin()?'ผู้ดูแลระบบ':'ครูผู้สอน';
 document.querySelectorAll('.admin-only').forEach(x=>x.hidden=!admin());
 $('adminDate').textContent=thDate(isoLocal(new Date()));
 try{await refreshProtected();setAdminTab('overview');}catch(err){toast('ไม่สามารถโหลดข้อมูลหลังบ้าน: '+eMsg(err),true);}
}
function setAdminTab(tab){
 if(!ADMIN_TITLES[tab])return;
 if(['worksheets','subjects','announcements','settings'].includes(tab)&&!admin())return;
 s.tab=tab;$('adminTitle').textContent=ADMIN_TITLES[tab];
 document.querySelectorAll('.side-btn').forEach(x=>x.classList.toggle('active',x.dataset.adminView===tab));
 if(tab==='overview')renderOverview();
 if(tab==='attendance')loadAttendance();
 if(tab==='students')renderStudents();
 if(tab==='assessments')renderAssessments();
 if(tab==='worksheets')renderWorksheetManager();
 if(tab==='subjects')renderSubjectManager();
 if(tab==='announcements')renderAnnouncementManager();
 if(tab==='settings')renderSiteSettings();
}
function renderOverview(){
 const c=s.students.length,tests=s.assessments.length;
 $('adminContent').innerHTML='<div class="stats-grid">'+stat('นักเรียนในความรับผิดชอบ',c,'คน')+stat('ชั้นเรียน',s.classes.length,'ห้อง')+stat('กิจกรรมประเมิน',tests,'รายการ')+stat('ใบงานที่เผยแพร่',s.publicWorksheets.length,'รายการ')+'</div>'+
 '<div class="split-grid"><div class="admin-panel"><div class="panel-head"><h2>ชั้นเรียนของฉัน</h2>'+smallButton('go-attendance','เช็คชื่อ →','primary')+'</div>'+
 (s.classes.length?s.classes.map(c=>'<div class="list-item"><div><strong>'+h(c.name)+'</strong><small>'+fmt(s.students.filter(x=>x.class_id===c.id).length)+' คน</small></div><span class="tag">พร้อมเช็คชื่อ</span></div>').join(''):empty('ยังไม่ได้รับมอบหมายชั้นเรียน','ผู้ดูแลระบบต้องเพิ่มห้องหรือมอบหมายสิทธิ์'))+'</div>'+
 '<div class="admin-panel"><div class="panel-head"><h2>เมนูลัด</h2></div><div class="row-actions">'+
 smallButton('go-assessments','▤ ประเมินและบันทึกคะแนน','primary')+
 smallButton('go-students','♙ จัดการรายชื่อ')+
 (admin()?smallButton('go-worksheets','◈ เพิ่มใบงาน')+smallButton('go-subjects','+ จัดการรายวิชา'):'')+'</div>'+
 '<div class="info-callout">ข้อมูลรายบุคคลและคะแนนจะแสดงเฉพาะผู้ที่ลงชื่อเข้าใช้และมีสิทธิ์ในชั้นเรียนเท่านั้น</div></div></div>';
}
async function loadAttendance(){
 if(s.tab!=='attendance')return;
 $('adminContent').innerHTML='<div class="admin-panel">กำลังโหลดข้อมูลการเช็คชื่อ...</div>';
 try{s.attendance=await allRows('attendance','student_id,attendance_date,status,note','student_id',q=>q.eq('attendance_date',s.attDate));renderAttendance();}
 catch(err){$('adminContent').innerHTML=empty('โหลดข้อมูลไม่ได้',eMsg(err));}
}
function attOf(id){return s.attendance.find(a=>a.student_id===id);}
function renderAttendance(){
 const people=s.students.filter(x=>x.class_id===s.classId).sort((a,b)=>a.student_no-b.student_no);
 const marked=people.filter(p=>!!attOf(p.id)).length;
 const rows=people.map(p=>{
  const record=attOf(p.id);
  const statusBtns=Object.entries(STATUSES).map(([k,label])=>
   '<button type="button" data-action="set-status" data-id="'+h(p.id)+'" data-status="'+k+'" class="status-btn '+(record?.status===k?'selected '+k:'')+'">'+label+'</button>').join('');
  return '<tr><td>'+fmt(p.student_no)+'</td><td><strong>'+h(p.full_name)+'</strong></td><td><div class="status-row">'+statusBtns+'</div></td><td>'+
  smallButton('attendance-note',record?.note?'แก้หมายเหตุ':'หมายเหตุ','outline','data-id="'+h(p.id)+'"')+
  ' '+(record?smallButton('clear-status','ล้าง','outline','data-id="'+h(p.id)+'"'):'')+'</td></tr>';
 }).join('');
 $('adminContent').innerHTML='<div class="admin-panel"><div class="panel-head"><h2>เช็คชื่อประจำวัน</h2>'+smallButton('bulk-present','✓ เช็คที่เหลือเป็นมาเรียน','primary')+'</div>'+
 '<div class="tool-row"><label class="field-inline">ชั้นเรียน<select class="control" data-control="classId">'+adminOptions(s.classId)+'</select></label>'+
 '<label class="field-inline">วันที่<input class="control" type="date" data-control="attDate" value="'+h(s.attDate)+'"></label>'+
 '<span class="tag green">เช็คแล้ว '+fmt(marked)+' / '+fmt(people.length)+'</span>'+smallButton('attendance-export','ส่งออก CSV')+'</div>'+
 (people.length?'<div class="table-wrap"><table class="data-table"><thead><tr><th>เลขที่</th><th>ชื่อ - สกุล</th><th>สถานะการเข้าเรียน</th><th>หมายเหตุ</th></tr></thead><tbody>'+rows+'</tbody></table></div>':empty('ยังไม่มีนักเรียนในห้องนี้','เพิ่มนักเรียนก่อนเช็คชื่อ'))+'</div>';
}
async function mark(id,status){
 if(!s.students.find(x=>x.id===id)||!Object.hasOwn(STATUSES,status))return;
 const old=attOf(id);
 await transact(async()=>{
  const {error}=await db.from('attendance').upsert({student_id:id,attendance_date:s.attDate,status,note:old?.note||''},{onConflict:'student_id,attendance_date'});
  if(error)throw error;await loadAttendance();
 },'บันทึกการเช็คชื่อสำเร็จ');
}
async function clearStatus(id){
 if(!attOf(id))return;
 await transact(async()=>{
  const {error}=await db.from('attendance').delete().eq('student_id',id).eq('attendance_date',s.attDate);
  if(error)throw error;await loadAttendance();
 },'ล้างสถานะแล้ว');
}
async function bulkPresent(){
 if(!s.classId)return toast('กรุณาเลือกชั้นเรียน',true);
 const list=s.students.filter(x=>x.class_id===s.classId&&!attOf(x.id));
 if(!list.length)return toast('เช็คชื่อครบแล้ว');
 if(!confirm('บันทึกนักเรียน '+list.length+' คนที่ยังไม่เช็คเป็น “มาเรียน” ใช่หรือไม่?'))return;
 await transact(async()=>{
  for(let i=0;i<list.length;i+=100){
   const {error}=await db.from('attendance').upsert(list.slice(i,i+100).map(x=>({student_id:x.id,attendance_date:s.attDate,status:'present'})),{onConflict:'student_id,attendance_date'});
   if(error)throw error;
  }
  await loadAttendance();
 },'บันทึกสถานะของนักเรียนที่ยังไม่เช็คแล้ว');
}
function renderStudents(){
 const filter=s.students.filter(p=>(s.studentClass==='all'||p.class_id===s.studentClass)&&
   (p.full_name+' '+p.student_no+' '+className(p.class_id)).toLowerCase().includes(s.studentSearch.toLowerCase()))
   .sort((a,b)=>className(a.class_id).localeCompare(className(b.class_id),'th')||a.student_no-b.student_no);
 const rows=filter.map(p=>'<tr><td>'+h(className(p.class_id))+'</td><td>'+fmt(p.student_no)+'</td><td>'+h(p.full_name)+'</td><td>'+
  '<div class="row-actions">'+smallButton('edit-student','แก้ไข','outline','data-id="'+h(p.id)+'"')+smallButton('remove-student','ลบ','danger','data-id="'+h(p.id)+'"')+'</div></td></tr>').join('');
 $('adminContent').innerHTML='<div class="admin-panel"><div class="panel-head"><h2>รายชื่อนักเรียน</h2>'+smallButton('add-student','+ เพิ่มนักเรียน','primary')+'</div>'+
 '<div class="tool-row"><label class="field-inline">ชั้นเรียน<select class="control" data-control="studentClass">'+adminOptions(s.studentClass,true)+'</select></label>'+
 '<label class="field-inline field-search">ค้นหา<input class="control" type="search" data-control="studentSearch" value="'+h(s.studentSearch)+'" placeholder="ชื่อหรือเลขที่"></label>'+
 smallButton('students-export','ส่งออก CSV')+'</div>'+
 (filter.length?'<div class="table-wrap"><table class="data-table"><thead><tr><th>ชั้นเรียน</th><th>เลขที่</th><th>ชื่อ - นามสกุล</th><th>จัดการ</th></tr></thead><tbody>'+rows+'</tbody></table></div>':
 empty('ไม่พบรายชื่อนักเรียน','เพิ่มรายชื่อ หรือเลือกชั้นเรียนที่มีสิทธิ์เข้าถึง'))+
 '<p class="muted" style="font-size:11px;margin:16px 0 0">สำหรับการนำเข้ารายชื่อ CSV และมอบหมายครู สามารถใช้ระบบจัดการชั้นเรียนเดิมที่เมนูด้านซ้าย</p></div>';
}
function renderAssessments(){
 const list=s.assessments.filter(a=>!s.classId||a.class_id===s.classId)
  .sort((a,b)=>b.assessment_date.localeCompare(a.assessment_date));
 const items=list.map(a=>'<div class="card-management"><div><h3>'+h(a.title)+'</h3><p>'+h(className(a.class_id))+' · '+h(subjectById(a.subject_id)?.name||'ไม่ระบุรายวิชา')+' · '+(a.is_published?'คะแนนที่เผยแพร่':'คะแนนส่วนตัว')+' · '+h(CATEGORIES[a.category])+' · '+h(thDate(a.assessment_date))+' · คะแนนเต็ม '+h(a.max_score)+'</p></div>'+
 '<div class="row-actions">'+smallButton('open-scores','ให้คะแนน','primary','data-id="'+h(a.id)+'"')+
 smallButton('edit-assessment','แก้ไข','outline','data-id="'+h(a.id)+'"')+
 smallButton('delete-assessment','ลบ','danger','data-id="'+h(a.id)+'"')+'</div></div>').join('');
 $('adminContent').innerHTML='<div class="admin-panel"><div class="panel-head"><h2>กิจกรรมและแบบประเมิน</h2>'+smallButton('new-assessment','+ สร้างกิจกรรมประเมิน','primary')+'</div>'+
 '<div class="tool-row"><label class="field-inline">ชั้นเรียน<select class="control" data-control="classId">'+adminOptions(s.classId)+'</select></label></div>'+
 (items||empty('ยังไม่มีแบบประเมิน','เลือกชั้นเรียนแล้วสร้างกิจกรรมประเมินครั้งแรก'))+'</div>'+
 (s.currentAssessment?'<section id="scoreSection"></section>':'');
 if(s.currentAssessment)showScoreTable();
}
async function loadScores(id){
 const assessment=s.assessments.find(x=>x.id===id);if(!assessment)return;
 s.currentAssessment=id;
 try{
  s.assessmentScores=await allRows('assessment_scores','assessment_id,student_id,score,feedback','student_id',q=>q.eq('assessment_id',id));
  renderAssessments();
  $('scoreSection')?.scrollIntoView({block:'nearest',behavior:'smooth'});
 }catch(err){toast(eMsg(err),true);}
}
function showScoreTable(){
 const a=s.assessments.find(x=>x.id===s.currentAssessment);
 if(!a)return;
 const people=s.students.filter(x=>x.class_id===a.class_id).sort((x,y)=>x.student_no-y.student_no);
 const scored=s.assessmentScores.filter(x=>x.score!==null).length;
 const rows=people.map(st=>{
  const old=s.assessmentScores.find(x=>x.student_id===st.id);
  return '<tr data-score-student="'+h(st.id)+'"><td>'+fmt(st.student_no)+'</td><td>'+h(st.full_name)+'</td>'+
  '<td><input aria-label="คะแนน '+h(st.full_name)+'" class="control score-number" type="number" min="0" max="'+h(a.max_score)+'" step="0.01" value="'+h(old?.score??'')+'" placeholder="—"></td>'+
  '<td><input aria-label="ข้อเสนอแนะ" class="control score-feedback" maxlength="1000" type="text" value="'+h(old?.feedback||'')+'" placeholder="หมายเหตุ"></td>'+
  '<td><div class="row-actions">'+smallButton('save-score','บันทึก','primary','data-id="'+h(st.id)+'"')+
  (old?smallButton('delete-score','ล้าง','danger','data-id="'+h(st.id)+'"'):'')+'</div></td></tr>';
 }).join('');
 $('scoreSection').innerHTML='<div class="admin-panel"><div class="panel-head"><div><h2>บันทึกคะแนน: '+h(a.title)+'</h2><p class="muted" style="font-size:12px;margin:4px 0">'+h(className(a.class_id))+' · เต็ม '+h(a.max_score)+' คะแนน · บันทึกแล้ว '+fmt(scored)+'/'+fmt(people.length)+'</p></div>'+
 '<div class="row-actions">'+smallButton('score-export','ส่งออกคะแนน CSV')+smallButton('close-scores','ปิดตาราง')+'</div></div>'+
 (people.length?'<div class="table-wrap"><table class="data-table"><thead><tr><th>เลขที่</th><th>นักเรียน</th><th>คะแนน</th><th>ข้อเสนอแนะ</th><th>จัดการ</th></tr></thead><tbody>'+rows+'</tbody></table></div>':empty('ไม่มีนักเรียน','เพิ่มรายชื่อในชั้นเรียนนี้ก่อนบันทึกคะแนน'))+
 '<div class="info-callout">กรอกคะแนนระหว่าง 0 ถึง '+h(a.max_score)+' แล้วกดบันทึกทีละคน ข้อมูลนี้เป็นส่วนตัวและจะไม่ปรากฏบนหน้าเว็บไซต์นักเรียน</div></div>';
}
async function saveScore(stId){
 const a=s.assessments.find(x=>x.id===s.currentAssessment),student=s.students.find(x=>x.id===stId);
 const row=document.querySelector('tr[data-score-student="'+CSS.escape(stId)+'"]');
 if(!a||!student||!row)return;
 const raw=row.querySelector('.score-number').value,feedback=row.querySelector('.score-feedback').value;
 if(!raw.trim())return toast('กรุณาระบุคะแนน หรือกดล้างรายการเดิม',true);
 const score=Number(raw);
 if(!Number.isFinite(score)||score<0||score>Number(a.max_score))return toast('คะแนนต้องอยู่ระหว่าง 0 ถึง '+a.max_score,true);
 if(feedback.length>1000)return toast('หมายเหตุยาวเกินกำหนด',true);
 await transact(async()=>{
  const {error}=await db.from('assessment_scores').upsert({assessment_id:a.id,student_id:stId,score,feedback},{onConflict:'assessment_id,student_id'});
  if(error)throw error;await loadScores(a.id);
 },'บันทึกคะแนนแล้ว');
}
async function removeScore(stId){
 const a=s.assessments.find(x=>x.id===s.currentAssessment);if(!a)return;
 await transact(async()=>{
  const {error}=await db.from('assessment_scores').delete().eq('assessment_id',a.id).eq('student_id',stId);
  if(error)throw error;await loadScores(a.id);
 },'ล้างคะแนนแล้ว');
}
function renderWorksheetManager(){
 if(!admin())return;
 const rows=s.worksheets.map(w=>'<div class="card-management"><div><h3>'+h(w.title)+'</h3><p>'+h(w.grade_label||'ทุกระดับ')+' · '+h(subjectName(w))+' · '+(w.is_published?'เผยแพร่':'ฉบับร่าง')+'</p></div><div class="row-actions">'+
 smallButton('edit-worksheet','แก้ไข','outline','data-id="'+h(w.id)+'"')+
 smallButton('remove-worksheet','ลบ','danger','data-id="'+h(w.id)+'"')+
 (w.is_published?'<span class="tag green">เผยแพร่</span>':'<span class="tag yellow">ฉบับร่าง</span>')+'</div></div>').join('');
 $('adminContent').innerHTML='<div class="admin-panel"><div class="panel-head"><h2>คลังใบงานและเอกสาร</h2>'+smallButton('new-worksheet','+ เพิ่มใบงาน','primary')+'</div>'+
 '<div class="info-callout">รองรับ PDF, PNG, JPG และ DOCX ขนาดไม่เกิน 10 MB หรือระบุลิงก์ HTTPS ไฟล์ที่เผยแพร่จะเปิดได้สาธารณะ จึงไม่ควรอัปโหลดข้อมูลส่วนตัวของนักเรียน</div>'+
 (rows||empty('ยังไม่มีใบงาน','กดเพิ่มใบงานเพื่ออัปโหลดไฟล์หรือแนบลิงก์'))+'</div>';
}
function renderSubjectManager(){
 if(!admin())return;
 const items=s.subjects.map(x=>{
  const worksheets=s.worksheets.filter(w=>w.subject_id===x.id).length;
  const assessments=s.assessments.filter(a=>a.subject_id===x.id).length;
  return '<div class="card-management"><div><h3>'+h(x.name)+'</h3><p>'+
   (x.subject_code?h(x.subject_code)+' · ':'')+h(x.description||'ไม่มีคำอธิบาย')+'</p>'+
   '<p class="muted">ใบงาน '+fmt(worksheets)+' รายการ · แบบประเมิน '+fmt(assessments)+' รายการ · '+
   (x.is_active?'แสดงบนเว็บไซต์':'ซ่อนจากเว็บไซต์')+'</p></div><div class="row-actions">'+
   smallButton('edit-subject','แก้ไข','outline','data-id="'+h(x.id)+'"')+
   smallButton('delete-subject','ลบ','danger','data-id="'+h(x.id)+'"')+
   '</div></div>';
 }).join('');
 $('adminContent').innerHTML='<div class="admin-panel"><div class="panel-head"><h2>จัดการรายวิชา</h2>'+
 smallButton('new-subject','+ เพิ่มรายวิชา','primary')+'</div>'+
 '<div class="info-callout">เพิ่มรายวิชา เช่น คณิตศาสตร์ ภาษาไทย ภาษาอังกฤษ วิทยาศาสตร์ หรือศิลปะ แล้วเลือกใช้ในใบงานและกิจกรรมประเมินได้ทันที</div>'+
 (items||empty('ยังไม่มีรายวิชา','กดเพิ่มรายวิชาเพื่อเริ่มต้น'))+'</div>';
}
function subjectModal(id){
 if(!admin())return;
 const old=s.subjects.find(x=>x.id===id);
 modal(old?'แก้ไขรายวิชา':'เพิ่มรายวิชา',
  inputField('name','ชื่อรายวิชา',old?.name||'','text',true,'maxlength="150"')+
  inputField('subject_code','รหัสวิชา (ถ้ามี)',old?.subject_code||'','text',false,'maxlength="40"')+
  textareaField('description','คำอธิบายรายวิชา',old?.description||'','maxlength="1500"')+
  inputField('sort_order','ลำดับแสดงผล',old?.sort_order??0,'number',true,'min="0" max="100000" step="1"')+
  checkboxField('is_active','แสดงรายวิชาบนเว็บไซต์',old?.is_active??true),async form=>{
   const name=String(form.get('name')||'').trim(),code=String(form.get('subject_code')||'').trim();
   const description=String(form.get('description')||'').trim(),order=Number(form.get('sort_order'));
   if(!name||name.length>150||code.length>40||description.length>1500)throw Error('กรุณากรอกข้อมูลรายวิชาให้ถูกต้อง');
   if(!Number.isInteger(order)||order<0||order>100000)throw Error('ลำดับแสดงผลต้องเป็นจำนวนเต็มระหว่าง 0–100000');
   const val={name,subject_code:code,description,sort_order:order,is_active:form.get('is_active')==='on'};
   const {error}=await (old?db.from('teacher_subjects').update(val).eq('id',old.id):db.from('teacher_subjects').insert(val));
   if(error)throw error.code==='23505'?new Error('ชื่อรายวิชานี้มีอยู่แล้ว'):error;
   await Promise.all([refreshProtected(),refreshPublic()]);
   renderSubjectManager();
  });
}
async function deleteSubject(id){
 if(!admin())return;
 const x=s.subjects.find(a=>a.id===id);if(!x)return;
 const count=s.worksheets.filter(w=>w.subject_id===id).length+s.assessments.filter(a=>a.subject_id===id).length;
 if(!confirm('ลบรายวิชา “'+x.name+'” ใช่หรือไม่?'+(count?'\nมีใบงานหรือแบบประเมินที่ผูกอยู่ '+count+' รายการ ซึ่งจะยังอยู่แต่ไม่ถูกจัดอยู่ในวิชานี้':'')))return;
 await transact(async()=>{
  const {error}=await db.from('teacher_subjects').delete().eq('id',id);
  if(error)throw error;
  await Promise.all([refreshProtected(),refreshPublic()]);
  renderSubjectManager();
 },'ลบรายวิชาเรียบร้อย');
}
function renderAnnouncementManager(){
 if(!admin())return;
 const items=s.announcements.map(a=>'<div class="card-management"><div><h3>'+h(a.title)+'</h3><p>'+h(a.body).slice(0,130)+' · '+(a.is_published?'เผยแพร่':'ฉบับร่าง')+'</p></div><div class="row-actions">'+
 smallButton('edit-announcement','แก้ไข','outline','data-id="'+h(a.id)+'"')+
 smallButton('remove-announcement','ลบ','danger','data-id="'+h(a.id)+'"')+'</div></div>').join('');
 $('adminContent').innerHTML='<div class="admin-panel"><div class="panel-head"><h2>ประกาศและกิจกรรม</h2>'+smallButton('new-announcement','+ เพิ่มประกาศ','primary')+'</div>'+ (items||empty('ยังไม่มีประกาศ','เพิ่มประกาศสำหรับนักเรียนจากหลังบ้าน'))+'</div>';
}
function renderSiteSettings(){
 if(!admin())return;
 const x=s.site;
 $('adminContent').innerHTML='<div class="admin-panel"><div class="panel-head"><h2>ปรับแต่งเว็บไซต์ส่วนตัว</h2>'+smallButton('edit-site','แก้ไขข้อความหน้าเว็บ','primary')+'</div>'+
 [['ชื่อเว็บไซต์',x.site_title],['ชื่อครู',x.teacher_name],['คำโปรย',x.tagline],['กลุ่มสาระ/วิชา',x.subject],['ข้อความแนะนำ',x.introduction]]
 .map(([k,v])=>'<div class="list-item"><div><small>'+h(k)+'</small><strong style="font-weight:500">'+h(v)+'</strong></div></div>').join('')+
 '<div class="info-callout">ชื่อครู คำแนะนำ ข้อความหน้าแรก ใบงาน และประกาศ สามารถแก้ไขได้จากหลังบ้านโดยไม่ต้องแก้โค้ดเว็บไซต์</div></div>';
}
function inputField(name,label,value='',type='text',required=true,extra=''){
 return '<label>'+h(label)+'<input class="control" name="'+h(name)+'" type="'+type+'" value="'+h(value)+'" '+(required?'required':'')+' '+extra+'></label>';
}
function textareaField(name,label,value='',extra=''){
 return '<label>'+h(label)+'<textarea class="control" name="'+h(name)+'" '+extra+'>'+h(value)+'</textarea></label>';
}
function selectField(name,label,options,value,required=true){
 return '<label>'+h(label)+'<select class="control" name="'+h(name)+'"'+(required?' required':'')+'>'+options.map(([v,t])=>
 '<option value="'+h(v)+'"'+(String(value)===String(v)?' selected':'')+'>'+h(t)+'</option>').join('')+'</select></label>';
}
function checkboxField(name,label,value){return '<label class="check-label"><input name="'+h(name)+'" type="checkbox" '+(value?'checked':'')+'>'+h(label)+'</label>';}
let modalAction=null;
function modal(title,fields,handler){
 modalAction=handler;$('modalTitle').textContent=title;$('modalFields').innerHTML=fields;
 $('modalError').textContent='';$('saveModal').disabled=false;
 $('editModal').showModal();
}
function closeModal(){if($('editModal').open)$('editModal').close();modalAction=null;}
function studentModal(id){
 const old=s.students.find(x=>x.id===id);
 if(!s.classes.length)return toast('กรุณาสร้างชั้นเรียนก่อน',true);
 modal(old?'แก้ไขนักเรียน':'เพิ่มนักเรียน',
  selectField('class_id','ชั้นเรียน',s.classes.map(c=>[c.id,c.name]),old?.class_id||s.classId)+
  inputField('student_no','เลขที่',old?.student_no||'','number',true,'min="1" max="999" step="1"')+
  inputField('full_name','ชื่อ - นามสกุล',old?.full_name||'','text',true,'maxlength="200"'),async f=>{
   const val={class_id:String(f.get('class_id')),student_no:Number(f.get('student_no')),full_name:String(f.get('full_name')).trim()};
   if(!val.full_name||!Number.isInteger(val.student_no)||val.student_no<1||val.student_no>999)throw Error('กรอกข้อมูลนักเรียนให้ถูกต้อง');
   const q=old?db.from('students').update(val).eq('id',old.id):db.from('students').insert(val);
   const {error}=await q;if(error)throw error;
   await refreshProtected();renderStudents();
  });
}
function assessmentModal(id){
 const old=s.assessments.find(x=>x.id===id);
 if(!s.classes.length)return toast('กรุณาสร้างชั้นเรียนก่อน',true);
 modal(old?'แก้ไขแบบประเมิน':'สร้างกิจกรรมประเมิน',
  selectField('class_id','ชั้นเรียน',s.classes.map(c=>[c.id,c.name]),old?.class_id||s.classId)+
  selectField('subject_id','รายวิชา',subjectOptions(old?.subject_id||''),old?.subject_id||(s.publicSubjects[0]?.id||''),false)+
  inputField('title','ชื่อกิจกรรม/แบบประเมิน',old?.title||'','text',true,'maxlength="200"')+
  selectField('category','ประเภท',Object.entries(CATEGORIES),old?.category||'worksheet')+
  inputField('max_score','คะแนนเต็ม',old?.max_score||10,'number',true,'min="0.01" max="10000" step="0.01"')+
  inputField('assessment_date','วันที่ประเมิน',old?.assessment_date||isoLocal(new Date()),'date',true)+
  textareaField('details','รายละเอียด',old?.details||'','maxlength="1000"')+
  checkboxField('is_published','เผยแพร่คะแนนให้นักเรียนเห็น',old?.is_published??false),async f=>{
   const max=Number(f.get('max_score'));
   if(!Number.isFinite(max)||max<=0||max>10000)throw Error('คะแนนเต็มต้องมากกว่า 0 และไม่เกิน 10,000');
   const val={class_id:String(f.get('class_id')),subject_id:String(f.get('subject_id')||'')||null,title:String(f.get('title')).trim(),category:String(f.get('category')),
     max_score:max,assessment_date:String(f.get('assessment_date')),details:String(f.get('details')).trim(),is_published:f.get('is_published')==='on'};
   if(!val.title)throw Error('กรอกชื่อกิจกรรม');
   const {error}=await (old?db.from('assessments').update(val).eq('id',old.id):db.from('assessments').insert(val));
   if(error)throw error;
   await refreshProtected();renderAssessments();
  });
}
function worksheetModal(id){
 if(!admin())return;
 const old=s.worksheets.find(x=>x.id===id);
 modal(old?'แก้ไขใบงาน':'เพิ่มใบงาน',
  inputField('title','ชื่อใบงาน',old?.title||'','text',true,'maxlength="240"')+
  textareaField('description','รายละเอียดใบงาน',old?.description||'','maxlength="3000"')+
  selectField('subject_id','รายวิชา',subjectOptions(old?.subject_id||''),old?.subject_id||(s.publicSubjects[0]?.id||''),false)+
  inputField('grade_label','ระดับชั้น เช่น ป.5',old?.grade_label||'','text',false,'maxlength="100"')+
  '<label>เลือกไฟล์ใบงาน (PDF, DOCX, JPG, PNG สูงสุด 10 MB)<input type="file" class="control" name="file" accept=".pdf,.docx,.png,.jpg,.jpeg"></label>'+
  inputField('external_url','หรือใส่ลิงก์ HTTPS',old?.external_url||'','url',false,'placeholder="https://"')+
  checkboxField('is_published','เผยแพร่ให้นักเรียนเห็นทันที',old?.is_published??false),async f=>{
   const file=f.get('file'),external=String(f.get('external_url')||'').trim();
   const hasFile=file instanceof File && file.size>0;
   if(!old&&!hasFile&&!external)throw Error('กรุณาอัปโหลดไฟล์หรือใส่ลิงก์ใบงาน');
   if(external&&!/^https:\/\//i.test(external))throw Error('ลิงก์ต้องขึ้นต้นด้วย https://');
   const mimeToExt={'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg','application/vnd.openxmlformats-officedocument.wordprocessingml.document':'docx'};
   if(hasFile&&(!mimeToExt[file.type]||file.size>10*1024*1024))throw Error('ไฟล์ต้องเป็น PDF, DOCX, PNG หรือ JPG และไม่เกิน 10 MB');
   let path=old?.file_path||null;
   let uploaded=null;
   if(hasFile){
    uploaded='worksheets/'+crypto.randomUUID()+'.'+mimeToExt[file.type];
    const {error}=await db.storage.from('teacher-worksheets').upload(uploaded,file,{contentType:file.type,upsert:false,cacheControl:'3600'});
    if(error)throw error;path=uploaded;
   }
   const val={
    title:String(f.get('title')).trim(),description:String(f.get('description')).trim(),
    subject_id:String(f.get('subject_id')||'')||null,
     subject:subjectById(String(f.get('subject_id')||''))?.name||'',grade_label:String(f.get('grade_label')).trim(),
    external_url:hasFile?null:(external||null),file_path:path,is_published:f.get('is_published')==='on'
   };
   if(!val.title)throw Error('กรอกชื่อใบงาน');
   try{
    const {error}=await (old?db.from('worksheets').update(val).eq('id',old.id):db.from('worksheets').insert(val));
    if(error)throw error;
   }catch(e){if(uploaded)await db.storage.from('teacher-worksheets').remove([uploaded]);throw e;}
   await Promise.all([refreshProtected(),refreshPublic()]);
   renderWorksheetManager();
  });
}
function announcementModal(id){
 if(!admin())return;
 const old=s.announcements.find(x=>x.id===id);
 modal(old?'แก้ไขประกาศ':'เพิ่มประกาศ',
  inputField('title','หัวข้อประกาศ',old?.title||'','text',true,'maxlength="200"')+
  textareaField('body','รายละเอียด',old?.body||'','maxlength="3000"')+
  checkboxField('is_published','เผยแพร่ประกาศให้นักเรียนเห็น',old?.is_published??false),async f=>{
   const val={title:String(f.get('title')).trim(),body:String(f.get('body')).trim(),is_published:f.get('is_published')==='on'};
   if(!val.title)throw Error('กรอกหัวข้อประกาศ');
   const {error}=await(old?db.from('teacher_announcements').update(val).eq('id',old.id):db.from('teacher_announcements').insert(val));
   if(error)throw error;
   await Promise.all([refreshProtected(),refreshPublic()]);renderAnnouncementManager();
  });
}
function siteModal(){
 if(!admin())return;
 const x=s.site;
 modal('แก้ไขข้อความหน้าเว็บไซต์',
  inputField('site_title','ชื่อเว็บไซต์',x.site_title,'text',true,'maxlength="150"')+
  inputField('teacher_name','ชื่อครู',x.teacher_name,'text',true,'maxlength="150"')+
  inputField('tagline','ข้อความต้อนรับ',x.tagline,'text',true,'maxlength="300"')+
  inputField('subject','กลุ่มสาระ/วิชา',x.subject,'text',true,'maxlength="300"')+
  textareaField('introduction','แนะนำเว็บไซต์และการสอน',x.introduction,'maxlength="3000"'),async f=>{
   const val=Object.fromEntries(['site_title','teacher_name','tagline','subject','introduction'].map(k=>[k,String(f.get(k)).trim()]));
   const {error}=await db.from('teacher_site').update(val).eq('id',1);
   if(error)throw error;await refreshPublic();renderSiteSettings();
  });
}
async function transact(callback,success){
 if(s.busy)return;
 busy(true);
 try{await callback();toast(success||'บันทึกเรียบร้อย');}
 catch(err){toast(eMsg(err),true);}
 finally{busy(false);}
}
async function removeStudent(id){
 const p=s.students.find(x=>x.id===id);
 if(!p||!confirm('ลบ '+p.full_name+' และประวัติเช็คชื่อ/คะแนนทั้งหมดอย่างถาวร?'))return;
 await transact(async()=>{
  const {error}=await db.from('students').delete().eq('id',id);
  if(error)throw error;await refreshProtected();renderStudents();
 },'ลบนักเรียนแล้ว');
}
async function removeAssessment(id){
 const a=s.assessments.find(x=>x.id===id);
 if(!a||!confirm('ลบแบบประเมิน “'+a.title+'” และคะแนนทั้งหมดของกิจกรรมนี้?'))return;
 await transact(async()=>{
  const {error}=await db.from('assessments').delete().eq('id',id);
  if(error)throw error;
  if(s.currentAssessment===id)s.currentAssessment=null;
  await refreshProtected();renderAssessments();
 },'ลบแบบประเมินแล้ว');
}
async function removeWorksheet(id){
 if(!admin())return;
 const w=s.worksheets.find(x=>x.id===id);
 if(!w||!confirm('ลบใบงาน “'+w.title+'” อย่างถาวร?'))return;
 await transact(async()=>{
  const {error}=await db.from('worksheets').delete().eq('id',id);
  if(error)throw error;
  if(w.file_path){const removal=await db.storage.from('teacher-worksheets').remove([w.file_path]);if(removal.error)toast('ลบรายการแล้ว แต่ลบไฟล์ไม่สำเร็จ: '+eMsg(removal.error),true);}
  await Promise.all([refreshProtected(),refreshPublic()]);renderWorksheetManager();
 },'ลบใบงานแล้ว');
}
async function removeAnnouncement(id){
 if(!admin())return;
 const a=s.announcements.find(x=>x.id===id);
 if(!a||!confirm('ลบประกาศ “'+a.title+'” ใช่หรือไม่?'))return;
 await transact(async()=>{
  const {error}=await db.from('teacher_announcements').delete().eq('id',id);
  if(error)throw error;await Promise.all([refreshProtected(),refreshPublic()]);renderAnnouncementManager();
 },'ลบประกาศแล้ว');
}
async function note(id){
 const record=attOf(id),student=s.students.find(x=>x.id===id);
 if(!record)return toast('ต้องเช็คชื่อก่อนเพิ่มหมายเหตุ',true);
 const val=prompt('หมายเหตุสำหรับ '+student?.full_name,record.note||'');
 if(val===null)return;
 if(val.length>1000)return toast('หมายเหตุยาวเกิน 1,000 ตัวอักษร',true);
 await transact(async()=>{
  const {error}=await db.from('attendance').update({note:val}).eq('student_id',id).eq('attendance_date',s.attDate);
  if(error)throw error;await loadAttendance();
 },'บันทึกหมายเหตุแล้ว');
}
function csvCell(v){let t=String(v??'');if(/^\s*[=+\-@\t\r]/.test(t))t="'"+t;return '"'+t.replace(/"/g,'""')+'"';}
function downloadCSV(name,rows){
 const blob=new Blob(['\ufeff'+rows.map(a=>a.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function exportAttendance(){
 const people=s.students.filter(p=>p.class_id===s.classId).sort((a,b)=>a.student_no-b.student_no);
 const rows=[['วันที่','ชั้นเรียน','เลขที่','ชื่อ-นามสกุล','สถานะ','หมายเหตุ']];
 people.forEach(p=>{const r=attOf(p.id);rows.push([s.attDate,className(p.class_id),p.student_no,p.full_name,r?STATUSES[r.status]:'ยังไม่เช็ค',r?.note||'']);});
 downloadCSV('เช็คชื่อ_'+s.attDate+'.csv',rows);
}
function exportStudents(){
 const rows=[['ชั้นเรียน','เลขที่','ชื่อ-นามสกุล']];
 s.students.filter(p=>s.studentClass==='all'||p.class_id===s.studentClass).forEach(p=>rows.push([className(p.class_id),p.student_no,p.full_name]));
 downloadCSV('รายชื่อนักเรียน.csv',rows);
}
function exportScores(){
 const a=s.assessments.find(x=>x.id===s.currentAssessment);if(!a)return;
 const rows=[['กิจกรรม','ชั้นเรียน','เลขที่','ชื่อ-นามสกุล','คะแนน','คะแนนเต็ม','ข้อเสนอแนะ']];
 s.students.filter(p=>p.class_id===a.class_id).forEach(p=>{
  const r=s.assessmentScores.find(x=>x.student_id===p.id);
  rows.push([a.title,className(p.class_id),p.student_no,p.full_name,r?.score??'',a.max_score,r?.feedback||'']);
 });
 downloadCSV('คะแนน_'+a.assessment_date+'.csv',rows);
}
async function handleAction(el){
 if(s.busy)return;
 const act=el.dataset.action,id=el.dataset.id;
 if(act==='go-attendance')setAdminTab('attendance');
 if(act==='go-students')setAdminTab('students');
 if(act==='go-assessments')setAdminTab('assessments');
 if(act==='go-worksheets')setAdminTab('worksheets');
 if(act==='go-subjects')setAdminTab('subjects');
 if(act==='open-subject'){if(!s.publicSubjects.some(x=>x.id===id))return;s.publicSubjectFilter=id;setView('worksheets');}
 if(act==='set-status')await mark(id,el.dataset.status);
 if(act==='clear-status')await clearStatus(id);
 if(act==='attendance-note')await note(id);
 if(act==='bulk-present')await bulkPresent();
 if(act==='attendance-export')exportAttendance();
 if(act==='add-student')studentModal();
 if(act==='edit-student')studentModal(id);
 if(act==='remove-student')await removeStudent(id);
 if(act==='students-export')exportStudents();
 if(act==='new-assessment')assessmentModal();
 if(act==='edit-assessment')assessmentModal(id);
 if(act==='delete-assessment')await removeAssessment(id);
 if(act==='open-scores')await loadScores(id);
 if(act==='save-score')await saveScore(id);
 if(act==='delete-score')await removeScore(id);
 if(act==='close-scores'){s.currentAssessment=null;renderAssessments();}
 if(act==='score-export')exportScores();
 if(act==='new-subject')subjectModal();
 if(act==='edit-subject')subjectModal(id);
 if(act==='delete-subject')await deleteSubject(id);
 if(act==='new-worksheet')worksheetModal();
 if(act==='edit-worksheet')worksheetModal(id);
 if(act==='remove-worksheet')await removeWorksheet(id);
 if(act==='new-announcement')announcementModal();
 if(act==='edit-announcement')announcementModal(id);
 if(act==='remove-announcement')await removeAnnouncement(id);
 if(act==='edit-site')siteModal();
}
function wire(){
 $('brandLink').addEventListener('click',e=>{e.preventDefault();setView('home');});
 $('mobileMenuBtn').addEventListener('click',()=>$('publicNav').classList.toggle('open'));
 $('authButton').addEventListener('click',async()=>{
  if(!s.user)return loginView();
  await enterAdmin();
 });
 document.addEventListener('click',async e=>{
  const btn=e.target.closest('[data-view],[data-admin-view],[data-action]');
  if(!btn)return;
  if(btn.dataset.view){setView(btn.dataset.view);return;}
  if(btn.dataset.adminView){setAdminTab(btn.dataset.adminView);return;}
  if(btn.dataset.action)await handleAction(btn);
 });
 $('loginForm').addEventListener('submit',async e=>{
  e.preventDefault();if(s.busy||!db)return;
  const f=new FormData(e.target);
  busy(true);$('loginError').textContent='';
  try{
   const {data,error}=await db.auth.signInWithPassword({email:String(f.get('email')).trim(),password:String(f.get('password'))});
   if(error)throw error;s.user=data.user;
   await loadProfile();
   e.target.reset();
   busy(false);await enterAdmin();
  }catch(err){
   const message=String(err?.message||'').toLowerCase();
   $('loginError').textContent=
     message.includes('invalid login')||message.includes('invalid credentials')
       ?'อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีเมลใน Supabase หรือกด “ลืมรหัสผ่าน”'
     : message.includes('email not confirmed')
       ?'อีเมลนี้ยังไม่ได้ยืนยัน กรุณาตรวจสอบอีเมลยืนยันบัญชี'
     : message.includes('fetch')||message.includes('network')
       ?'เชื่อมต่อระบบไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่'
     :'เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบบัญชีและลองใหม่ ('+String(err?.code||'unknown')+')';
   busy(false);
  }
 });
 $('logoutBtn').addEventListener('click',async()=>{
  try{await db.auth.signOut();s.user=null;s.profile=null;s.students=[];s.classes=[];s.assessments=[];s.assessmentScores=[];s.attendance=[];setView('home');toast('ออกจากระบบแล้ว');}
  catch(e){toast(eMsg(e),true);}
 });
 $('publicContent').addEventListener('change',e=>{
  if(e.target.dataset.control==='publicSubject'){
   const id=e.target.value;
   s.publicSubjectFilter=id==='all'||s.publicSubjects.some(x=>x.id===id)?id:'all';
   setView('worksheets');
  }
 });
 $('adminContent').addEventListener('change',async e=>{
  const n=e.target.dataset.control;if(!n)return;
  if(n==='classId'){s.classId=e.target.value;s.currentAssessment=null;if(s.tab==='attendance')renderAttendance();else renderAssessments();}
  if(n==='attDate'){s.attDate=e.target.value||isoLocal(new Date());await loadAttendance();}
  if(n==='studentClass'){s.studentClass=e.target.value;renderStudents();}
  if(n==='studentSearch'){s.studentSearch=e.target.value;renderStudents();}
 });
 $('adminContent').addEventListener('input',e=>{
  if(e.target.dataset.control==='studentSearch'){
   s.studentSearch=e.target.value;
   const pos=e.target.selectionStart;renderStudents();
   const input=document.querySelector('[data-control="studentSearch"]');
   if(input){input.focus();input.setSelectionRange(pos,pos);}
  }
 });
 $('editForm').addEventListener('submit',async e=>{
  e.preventDefault();if(!modalAction||s.busy)return;
  busy(true);$('modalError').textContent='';
  try{await modalAction(new FormData(e.target));closeModal();toast('บันทึกข้อมูลเรียบร้อย');}
  catch(err){$('modalError').textContent=eMsg(err);}
  finally{busy(false);}
 });
 $('closeModal').addEventListener('click',closeModal);
 $('cancelModal').addEventListener('click',closeModal);
 $('editModal').addEventListener('click',e=>{if(e.target===$('editModal'))closeModal();});
 if(db)db.auth.onAuthStateChange((event)=>{
  if(event==='SIGNED_OUT'&&s.user){s.user=null;s.profile=null;setView('home');}
 });
}
wire();
initSession();
