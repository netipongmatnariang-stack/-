import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.0';
const cfg=window.APP_CONFIG||{};
const db=createClient(cfg.supabaseUrl,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
const $=id=>document.getElementById(id);
const h=x=>String(x??'').replace(/[&<>"']/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[k]));
let state={user:null,section:'',sections:[],subjects:[],classes:[],terms:[],students:[],categories:[],items:[],entries:[],scales:[],history:[],tasks:[],handler:null,busy:false};
const getName=(array,id,key='name')=>array.find(x=>x.id===id)?.[key]||'-';
const formInput=(key,label,value='',type='text',extra='')=>'<label>'+h(label)+'<input name="'+key+'" value="'+h(value)+'" type="'+type+'" '+extra+'></label>';
const button=(act,title,id='',color='')=>'<button type="button" class="btn '+color+'" data-act="'+h(act)+'" data-id="'+h(id)+'">'+h(title)+'</button>';
const opts=(array,selected)=>array.map(x=>'<option value="'+h(x.id)+'"'+(x.id===selected?' selected':'')+'>'+h(x.name)+'</option>').join('');
const cats=()=>state.categories.filter(x=>x.section_id===state.section).sort((a,b)=>a.sort_order-b.sort_order);
const items=()=>state.items.filter(x=>cats().some(c=>c.id===x.category_id)).sort((a,b)=>a.created_at.localeCompare(b.created_at));
const students=()=>state.students.filter(x=>x.class_id===state.sections.find(y=>y.id===state.section)?.class_id).sort((a,b)=>a.student_no-b.student_no);
const gradeEntry=(student_id,item_id)=>state.entries.find(x=>x.student_id===student_id&&x.item_id===item_id);
async function rows(table){
 const out=[],key=table==='grade_entries'?'student_id':table==='grade_history'?'changed_at':'id';
 for(let n=0;n<50000;n+=500){
  const {data,error}=await db.from(table).select('*').order(key).range(n,n+499);
  if(error)throw error;
  out.push(...data);if(data.length<500)return out;
 }
 throw Error('ข้อมูลเกิน 50,000 รายการ กรุณาแยกช่วงข้อมูล');
}
async function refresh(){
 const names=['course_sections','teacher_subjects','school_classes','academic_terms','students','grade_categories','grade_items','grade_entries','grade_scales','grade_history','assignment_tasks'];
 const sets=await Promise.all(names.map(rows));
 [state.sections,state.subjects,state.classes,state.terms,state.students,state.categories,state.items,state.entries,state.scales,state.history,state.tasks]=sets;
 if(!state.sections.some(x=>x.id===state.section))state.section=state.sections[0]?.id||'';
}
function sectionName(s){return getName(state.subjects,s.subject_id)+' · '+getName(state.classes,s.class_id)+' · '+getName(state.terms,s.term_id,'term_name');}
function result(student){
 const cs=cats(),its=items(),totalWeight=cs.reduce((n,x)=>n+Number(x.weight),0),configured=Math.abs(totalWeight-100)<0.005;
 let percentage=0,graded=0,complete=its.length>0&&configured;
 for(const cat of cs){
  const categoryItems=its.filter(x=>x.category_id===cat.id);
  if(!categoryItems.length&&Number(cat.weight)>0)complete=false;
  let earned=0,max=0;
  for(const item of categoryItems){
   max+=Number(item.max_score);
   const score=gradeEntry(student.id,item.id)?.score;
   if(score===null||score===undefined)complete=false;
   else{graded++;earned+=Number(score);}
  }
  if(max>0)percentage+=Number(cat.weight)*earned/max;
 }
 percentage=Math.round(percentage*100)/100;
 const scales=state.scales.filter(x=>x.section_id===state.section).sort((a,b)=>Number(b.minimum_percent)-Number(a.minimum_percent));
 const grade=complete?(scales.find(x=>percentage>=Number(x.minimum_percent))?.grade_label||'-'):'รอสรุป';
 return {percentage,graded,grade,complete,totalWeight};
}
function msg(text,error=false){$('message').hidden=false;$('message').className=error?'error':'ok';$('message').textContent=text;}
function actionModal(title,fields,handler){
 $('editTitle').textContent=title;$('editFields').innerHTML=fields;$('editError').hidden=true;
 state.handler=handler;$('editor').showModal();
}
function redraw(){
 const picker=$('courseSelect');
 picker.innerHTML=state.sections.map(s=>'<option value="'+h(s.id)+'"'+(s.id===state.section?' selected':'')+'>'+h(sectionName(s))+'</option>').join('');
 const cs=cats(),its=items(),people=students(),weight=cs.reduce((n,c)=>n+Number(c.weight),0);
 $('categories').innerHTML='<div class="row between"><h2>หมวดคะแนนและเกณฑ์ผลการเรียน</h2><div class="row">'+button('add-category','+ เพิ่มหมวด','','primary')+
 (cs.length?button('add-item','+ เพิ่มรายการคะแนน'):'')+button('edit-scale','เกณฑ์ตัดเกรด')+'</div></div>'+
 '<div class="cards"><div class="card"><span class="muted">น้ำหนักรวม</span><strong>'+weight.toFixed(2)+'%</strong></div>'+
 '<div class="card"><span class="muted">หมวดคะแนน</span><strong>'+cs.length+'</strong></div>'+
 '<div class="card"><span class="muted">รายการคะแนน</span><strong>'+its.length+'</strong></div>'+
 '<div class="card"><span class="muted">นักเรียน</span><strong>'+people.length+'</strong></div></div>'+
 (Math.abs(weight-100)>0.005?'<p class="error">น้ำหนักไม่เท่ากับ 100% จึงยังไม่แสดงเกรดสรุป</p>':'')+
 '<p class="info">นักเรียนจะเห็นเฉพาะคะแนนของตนเองจากรายการที่ครูเลือก “เผยแพร่” และในวิชาที่เปิดให้นักเรียนเห็นเท่านั้น</p>'+
 cs.map(c=>'<div class="line"><div class="row between"><div><strong>'+h(c.name)+'</strong> · '+h(c.weight)+'%<br>'+
 '<small class="muted">'+its.filter(i=>i.category_id===c.id).length+' รายการคะแนน</small></div><div>'+
 button('edit-category','แก้ไข',c.id)+' '+button('delete-category','ลบ',c.id,'danger')+'</div></div>'+
 its.filter(i=>i.category_id===c.id).map(i=>'<div class="row" style="margin:5px 0 5px 14px"><span class="muted">'+h(i.title)+' · เต็ม '+h(i.max_score)+
 (i.is_published?' · นักเรียนเห็นคะแนน':' · ส่วนตัว')+(i.task_id?' · เชื่อมงาน':'')+'</span>'+
 button('edit-item','แก้ไข',i.id)+' '+button('delete-item','ลบ',i.id,'danger')+'</div>').join('')+'</div>').join('')+
 (!cs.length?'<p class="muted">เพิ่มหมวด เช่น คะแนนเก็บ 60% และปลายภาค 40% ก่อนเปิดรายการคะแนน</p>':'');
 const head=its.map(i=>'<th>'+h(i.title)+'<br><small class="muted">เต็ม '+h(i.max_score)+'</small></th>').join('');
 const body=people.map(st=>{
  const r=result(st);
  return '<tr><td>'+st.student_no+'</td><td style="min-width:170px">'+h(st.full_name)+'</td>'+
  its.map(i=>'<td><input class="score-field" type="number" step="0.01" min="0" max="'+h(i.max_score)+'" data-student="'+h(st.id)+
   '" data-item="'+h(i.id)+'" value="'+h(gradeEntry(st.id,i.id)?.score??'')+'" aria-label="'+h(i.title+' '+st.full_name)+'"></td>').join('')+
  '<td>'+r.percentage.toFixed(2)+'%</td><td><strong>'+h(r.grade)+'</strong></td><td>'+r.graded+'/'+its.length+'</td></tr>';
 }).join('');
 $('gradeTable').innerHTML='<div class="row between" id="gradesActions"><h2>ตารางคะแนนรายบุคคล</h2><div class="row">'+button('csv','ส่งออก CSV')+
 button('print','พิมพ์ / PDF')+button('history','ประวัติการแก้ไข')+'</div></div>'+
 (its.length?'<form id="scoreForm"><div class="scroll"><table><thead><tr><th>เลขที่</th><th>ชื่อ-สกุล</th>'+head+
 '<th>รวมถ่วงน้ำหนัก</th><th>เกรด</th><th>บันทึกแล้ว</th></tr></thead><tbody>'+body+
 '</tbody></table></div><p class="muted">ช่องว่างหมายถึงยังไม่บันทึก ไม่ใช่ 0 คะแนน</p>'+
 '<button id="saveGrid" class="btn primary" type="submit">บันทึกคะแนน</button></form>':'<p class="muted">ยังไม่มีรายการคะแนน</p>');
 $('historyPane').hidden=true;
}
async function save(table,value,id){
 let q=db.from(table);
 const {error}=await(id?q.update(value).eq('id',id):q.insert(value));
 if(error)throw error;await refresh();redraw();
}
function categoryModal(id){
 const x=state.categories.find(y=>y.id===id)||{};
 actionModal(id?'แก้ไขหมวดคะแนน':'เพิ่มหมวดคะแนน',
 formInput('name','ชื่อหมวดคะแนน',x.name||'','text','maxlength="150" required')+
 formInput('weight','น้ำหนักคะแนน (%)',x.weight??0,'number','min="0" max="100" step="0.01" required')+
 formInput('sort_order','ลำดับ',x.sort_order??cats().length,'number','step="1" required'),async form=>{
  const weight=Number(form.get('weight'));if(!Number.isFinite(weight)||weight<0||weight>100)throw Error('น้ำหนักต้องระหว่าง 0 ถึง 100');
  await save('grade_categories',{section_id:state.section,name:String(form.get('name')||'').trim(),weight,sort_order:Number(form.get('sort_order'))},id);
 });
}
function itemModal(id){
 const x=state.items.find(y=>y.id===id)||{},cs=cats();
 if(!cs.length)return msg('ต้องมีหมวดคะแนนก่อน',true);
 const related=state.tasks.filter(x=>x.section_id===state.section);
 actionModal(id?'แก้ไขรายการคะแนน':'เพิ่มรายการคะแนน',
 '<label>หมวดคะแนน<select name="category_id" required>'+opts(cs,x.category_id||cs[0].id)+'</select></label>'+
 formInput('title','ชื่อรายการคะแนน',x.title||'','text','maxlength="200" required')+
 formInput('max_score','คะแนนเต็ม',x.max_score??10,'number','min="0.01" max="10000" step="0.01" required')+
 '<label>เชื่อมกับงานที่มอบหมาย<select name="task_id"><option value="">ไม่เชื่อม</option>'+opts(related,x.task_id)+'</select></label>'+
 '<label><input type="checkbox" name="is_published" '+(x.is_published?'checked':'')+'> เผยแพร่คะแนนนี้ให้เจ้าของบัญชีนักเรียนเห็น</label>',async form=>{
  const value={category_id:form.get('category_id'),title:String(form.get('title')||'').trim(),
   max_score:Number(form.get('max_score')),task_id:form.get('task_id')||null,is_published:form.has('is_published')};
  await save('grade_items',value,id);
 });
}
function scaleModal(){
 const labels=['4','3.5','3','2.5','2','1.5','1','0'];
 const defaults=[80,75,70,65,60,55,50,0];
 const scales=state.scales.filter(x=>x.section_id===state.section);
 actionModal('ตั้งเกณฑ์ตัดเกรด',
 '<p class="info">ระบุคะแนนขั้นต่ำแต่ละเกรด ค่าต้องลดลงตามลำดับและไม่มีค่าซ้ำกัน</p>'+
 labels.map((label,i)=>formInput('level'+i,'เกรด '+label+' (คะแนนขั้นต่ำ %)',scales.find(x=>x.grade_label===label)?.minimum_percent??defaults[i],
 'number','min="0" max="100" step="0.01" required')).join(''),async f=>{
  const all=labels.map((label,i)=>({grade_label:label,minimum_percent:Number(f.get('level'+i))}));
  if(all.some(x=>!Number.isFinite(x.minimum_percent)||x.minimum_percent<0||x.minimum_percent>100))throw Error('เกณฑ์ต้องอยู่ในช่วง 0–100');
  if(all[7].minimum_percent!==0)throw Error('เกรด 0 ต้องเริ่มที่ 0');
  for(let i=1;i<8;i++)if(all[i].minimum_percent>=all[i-1].minimum_percent)throw Error('ลำดับคะแนนขั้นต่ำต้องลดลงเสมอและไม่มีค่าซ้ำ');
  const {error}=await db.rpc('set_course_grade_scales',{p_section:state.section,p_scales:all});
  if(error)throw error;await refresh();redraw();
 });
}
