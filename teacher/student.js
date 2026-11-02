import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.0';
const cfg=window.APP_CONFIG||{},db=createClient(cfg.supabaseUrl,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
const $=id=>document.getElementById(id);
const h=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dt=x=>x?new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeZone:'Asia/Bangkok'}).format(new Date(String(x).slice(0,10)+'T12:00:00+07:00')):'ไม่กำหนด';
const link=v=>{try{const u=new URL(v);return u.protocol==='https:'?h(u.href):'#'}catch{return '#'}};
const S={user:null,account:null,student:null,tab:'courses',sections:[],subjects:[],terms:[],sessions:[],attendance:[],tasks:[],submissions:[],reviews:[],assessments:[],scores:[],units:[]};
const subj=id=>S.subjects.find(s=>s.id===id)?.name||'รายวิชา';
const sectionName=cs=>subj(cs.subject_id)+' · '+(S.terms.find(t=>t.id===cs.term_id)?.term_name||'ภาคเรียน');
async function get(table,query=null){
 const out=[];
 const sortKey=table==='assignment_reviews'?'submission_id':'id';
 for(let start=0;start<50000;start+=500){
  let r=db.from(table).select('*').order(sortKey);
  if(query)r=query(r);
  const {data,error}=await r.range(start,start+499);
  if(error)throw error;
  out.push(...(data||[]));if((data||[]).length<500)return out;
 }
 throw Error('ข้อมูลจำนวนมากเกินขอบเขต กรุณาติดต่อครูผู้ดูแล');
}
function notice(s,err=false){$('status').textContent=s;$('status').className=err?'err':'success';$('status').hidden=false;}
async function init(){
 try{
 const {data,error}=await db.auth.getUser();
 if(error)throw error;S.user=data?.user;
 if(!S.user){$('loginPanel').hidden=false;return;}
 $('logout').hidden=false;
 const {data:account,error:accErr}=await db.from('student_accounts').select('id,student_id,class_id').eq('user_id',S.user.id).maybeSingle();
 if(accErr)throw accErr;
 if(!account){$('notLinked').hidden=false;return;}
 S.account=account;
 const {data:student,error:studentErr}=await db.from('students').select('id,full_name,student_no,class_id').eq('id',account.student_id).single();
 if(studentErr)throw studentErr;S.student=student;
 $('studentInfo').innerHTML='<strong>'+h(student.full_name)+'</strong> <span class="status">เลขที่ '+h(student.student_no)+'</span>'+
 '<p class="muted">ข้อมูลส่วนตัวและคะแนนจะแสดงเฉพาะบัญชีของตนเอง</p>';
 await refresh();$('portal').hidden=false;draw();
 }catch(err){$('loginPanel').hidden=false;$('loginError').textContent='เปิดระบบนักเรียนไม่ได้: '+(err.message||err);$('loginError').hidden=false;}
}
async function refresh(){
 [S.sections,S.subjects,S.terms,S.sessions,S.attendance,S.tasks,S.submissions,S.reviews,S.assessments,S.scores,S.units]=await Promise.all([
 get('course_sections',q=>q.eq('is_published',true)),
 get('teacher_subjects',q=>q.eq('is_active',true)),
 get('academic_terms'),
 get('teaching_sessions'),
 get('period_attendance',q=>q.eq('student_id',S.account.student_id)),
 get('assignment_tasks',q=>q.eq('is_published',true)),
 get('assignment_submissions',q=>q.eq('student_id',S.account.student_id)),
 get('assignment_reviews'),
 get('assessments',q=>q.eq('class_id',S.account.class_id)),
 get('assessment_scores',q=>q.eq('student_id',S.account.student_id)),
 get('course_units',q=>q.eq('is_published',true))
 ]);
 S.sections=S.sections.filter(x=>x.class_id===S.account.class_id);
}
function coursePage(){
 if(!S.sections.length){$('content').innerHTML='<section class="panel"><p class="muted">ยังไม่มีรายวิชาที่ครูเปิดให้เข้าดู</p></section>';return;}
 $('content').innerHTML='<div class="cards">'+S.sections.map(cs=>{
 const held=S.sessions.filter(x=>x.section_id===cs.id&&x.is_held);
 const marked=S.attendance.filter(x=>held.some(s=>s.id===x.session_id));
 const weight=marked.reduce((n,x)=>n+(x.status==='present'?1:x.status==='late'?Number(cs.late_weight):['sick','personal'].includes(x.status)?Number(cs.leave_weight):0),0);
 const pct=held.length?Math.round(weight/held.length*10000)/100:0;
 const risk=held.length&&pct<Number(cs.minimum_attendance);
 const units=S.units.filter(u=>u.section_id===cs.id).sort((a,b)=>a.sequence_no-b.sequence_no);
 return '<section class="panel"><h2>'+h(sectionName(cs))+'</h2>'+
 '<div class="row"><span class="status">คาบสอนจริง '+held.length+'</span><span class="status">เกณฑ์ '+cs.minimum_attendance+'%</span></div>'+
 '<p>ร้อยละเวลาเรียน: <strong style="color:'+(risk?'#c34551':'#128069')+'">'+(held.length?pct.toFixed(2)+'%':'ยังไม่มีคาบเรียน')+'</strong></p>'+
 (held.length?'<div class="bar"><div style="width:'+Math.min(100,pct)+'%;background:'+(risk?'#e76466':'#15ad9a')+'"></div></div>':'')+
 (risk?'<p class="err" style="font-size:12px">เวลาเรียนต่ำกว่าเกณฑ์ที่ครูกำหนด กรุณาติดต่อครูผู้สอน</p>':'')+
 '<h3>หน่วยการเรียนรู้</h3>'+
 (units.length?units.map(u=>'<div class="card" style="margin:8px 0"><strong>หน่วยที่ '+u.sequence_no+': '+h(u.title)+'</strong><p class="muted">'+h(u.summary)+'</p>'+
 (u.resource_url?'<a href="'+link(u.resource_url)+'" target="_blank" rel="noopener noreferrer">เปิดบทเรียน/สื่อ ↗</a>':'')+'</div>').join(''):'<p class="muted">ยังไม่มีหน่วยการเรียนรู้ที่เผยแพร่</p>')+'</section>';
 }).join('')+'</div>';
}
function assignmentsPage(){
 const tasks=S.tasks.filter(t=>S.sections.some(x=>x.id===t.section_id));
 $('content').innerHTML='<section class="panel"><h2>ใบงานและงานที่ได้รับมอบหมาย</h2><p class="muted">ส่งงานได้เฉพาะบัญชีของตนเอง ครูเป็นผู้ตรวจและบันทึกคะแนน</p>'+
 (tasks.length?tasks.map(t=>{
 const cs=S.sections.find(x=>x.id===t.section_id),sub=S.submissions.find(x=>x.task_id===t.id);
 const review=S.reviews.find(x=>x.submission_id===sub?.id);
 const late=t.due_at&&Date.now()>new Date(t.due_at).getTime()&&!sub;
 return '<article class="card" style="margin:12px 0"><div class="row"><h3>'+h(t.title)+'</h3><span class="status">'+h(sub?(review?.status==='graded'?'ตรวจแล้ว':review?.status==='revision'?'ต้องแก้ไข':'ส่งแล้ว'):(late?'เลยกำหนดส่ง':'ยังไม่ส่ง'))+'</span></div>'+
 '<p class="muted">'+h(sectionName(cs))+' · กำหนดส่ง '+dt(t.due_at)+' · คะแนนเต็ม '+t.max_score+'</p>'+
 '<p>'+h(t.instructions)+'</p>'+
 (t.resource_url?'<p><a href="'+link(t.resource_url)+'" target="_blank" rel="noopener noreferrer">ดาวน์โหลดใบงาน ↗</a></p>':'')+
 (sub?'<p class="muted">ส่งเมื่อ '+dt(sub.submitted_at)+' '+(review?' · คะแนน '+h(review.score??'-'):'')+'</p>':'')+
 (review?.feedback?'<p class="success">ความคิดเห็นครู: '+h(review.feedback)+'</p>':'')+
 ((!sub||t.allow_resubmit)?'<button class="btn primary" data-action="submit" data-id="'+h(t.id)+'">'+(sub?'ส่งงานแก้ไข':'ส่งงาน')+'</button>':'<p class="muted">ไม่อนุญาตให้ส่งซ้ำ</p>')+
 '</article>';
 }).join(''):'<p class="muted">ยังไม่มีงานที่เผยแพร่สำหรับรายวิชาของคุณ</p>')+'</section>';
}
function scoresPage(){
 const assessments=S.assessments.filter(x=>S.sections.some(cs=>cs.class_id===x.class_id));
 $('content').innerHTML='<section class="panel"><h2>สมุดคะแนนของฉัน</h2><p class="muted">คะแนนนี้เป็นข้อมูลส่วนตัวของผู้เรียน ไม่เปิดเผยต่อบุคคลทั่วไป</p>'+
 '<div class="scroll"><table class="tbl"><thead><tr><th>วิชา</th><th>รายการประเมิน</th><th>วันที่</th><th>คะแนน</th></tr></thead><tbody>'+
 assessments.map(a=>{
 const score=S.scores.find(s=>s.assessment_id===a.id);
 return '<tr><td>'+h(subj(a.subject_id))+'</td><td>'+h(a.title)+'</td><td>'+dt(a.assessment_date)+'</td><td><strong>'+h(score?.score??'ยังไม่บันทึก')+'</strong> / '+h(a.max_score)+'</td></tr>';
 }).join('')+'</tbody></table></div>'+
 (assessments.length?'':'<p class="muted">ยังไม่มีผลประเมินที่บันทึก</p>')+'</section>';
}
function draw(){
 $('tabs').querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===S.tab));
 if(S.tab==='courses')coursePage();else if(S.tab==='assignments')assignmentsPage();else scoresPage();
}
async function submitAssignment(taskId){
 const t=S.tasks.find(x=>x.id===taskId),old=S.submissions.find(x=>x.task_id===taskId);
 if(!t)return;
 const wrapper=document.createElement('section');wrapper.className='panel';wrapper.id='submitPanel';
 wrapper.innerHTML='<h2>ส่งงาน: '+h(t.title)+'</h2>'+
 '<p class="muted">ไฟล์งานเป็นข้อมูลส่วนตัว จัดเก็บในพื้นที่ปิดของ Supabase จำกัด 10 MB ต่อไฟล์</p>'+
 '<form id="submissionForm"><label>ความคิดเห็น/ลิงก์คำอธิบาย<textarea name="note">'+h(old?.note||'')+'</textarea></label>'+
 '<label>ไฟล์งาน PDF, DOCX, PNG, JPG (ไม่บังคับ)<input type="file" name="file" accept=".pdf,.docx,.jpg,.jpeg,.png"></label>'+
 '<button class="btn primary" type="submit">บันทึกการส่งงาน</button> <button type="button" class="btn" id="cancelSubmission">ยกเลิก</button>'+
 '<p id="submissionError" class="err" hidden></p></form>';
 $('content').prepend(wrapper);wrapper.scrollIntoView({behavior:'smooth',block:'start'});
 wrapper.querySelector('#cancelSubmission').addEventListener('click',()=>wrapper.remove());
 wrapper.querySelector('#submissionForm').addEventListener('submit',async e=>{
 e.preventDefault();
 const form=e.target,f=new FormData(form),file=f.get('file'),isFile=file instanceof File&&file.size>0;
 const button=form.querySelector('[type=submit]');button.disabled=true;
 let file_path=old?.file_path||'';
 try{
 if(isFile){
 const kinds={'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg','application/vnd.openxmlformats-officedocument.wordprocessingml.document':'docx'};
 if(!kinds[file.type]||file.size>10*1024*1024)throw Error('ไฟล์ต้องเป็น PDF, DOCX, JPG หรือ PNG และไม่เกิน 10 MB');
 file_path=S.user.id+'/'+crypto.randomUUID()+'.'+kinds[file.type];
 const {error}=await db.storage.from('student-uploads').upload(file_path,file,{contentType:file.type,upsert:false});if(error)throw error;
 }
 const values={task_id:taskId,student_id:S.account.student_id,note:String(f.get('note')||''),file_path,submitted_at:new Date().toISOString()};
 const {error}=await db.from('assignment_submissions').upsert(values,{onConflict:'task_id,student_id'});
 if(error)throw error;
 await refresh();S.tab='assignments';draw();notice('ส่งงานเรียบร้อยแล้ว');
 }catch(err){wrapper.querySelector('#submissionError').textContent=err.message||String(err);wrapper.querySelector('#submissionError').hidden=false;}
 finally{button.disabled=false;}
 });
}
$('loginForm').addEventListener('submit',async e=>{
 e.preventDefault();const f=new FormData(e.target);
 const {error}=await db.auth.signInWithPassword({email:String(f.get('email')||'').trim(),password:String(f.get('password'))});
 if(error){$('loginError').hidden=false;$('loginError').textContent='เข้าสู่ระบบไม่สำเร็จ: '+error.message;return;}
 $('loginPanel').hidden=true;await init();
});
$('tabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(!b)return;S.tab=b.dataset.tab;draw();});
$('content').addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b?.dataset.action==='submit')submitAssignment(b.dataset.id);});
async function out(){await db.auth.signOut();location.reload();}
$('logout').addEventListener('click',out);$('notLinkedSignOut').addEventListener('click',out);
init();