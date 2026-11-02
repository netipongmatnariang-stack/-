import {db,$,h,state,refresh,redraw,msg,gradeEntry,result,cats,items,students,categoryModal,itemModal,scaleModal,getName} from './grades-base.js';
async function saveGrades(form){
 if(state.busy)return;state.busy=true;
 const submit=$('saveGrid');if(submit)submit.disabled=true;
 try{
  const updates=[];
  for(const input of form.querySelectorAll('.score-field')){
   const item=state.items.find(x=>x.id===input.dataset.item);
   const student_id=input.dataset.student;
   if(!item)continue;
   const score=input.value.trim()===''?null:Number(input.value);
   if(score!==null&&(!Number.isFinite(score)||score<0||score>Number(item.max_score)))
    throw Error('รายการ '+item.title+' คะแนนต้องอยู่ระหว่าง 0–'+item.max_score);
   const old=gradeEntry(student_id,item.id);
   if((old?.score??null)===score)continue;
   if(old?.score!==null&&old?.score!==undefined&&score!==null&&Number(old.score)===score)continue;
   updates.push({item_id:item.id,student_id,score,feedback:old?.feedback||''});
  }
  for(let n=0;n<updates.length;n+=100){
   const {error}=await db.from('grade_entries').upsert(updates.slice(n,n+100),{onConflict:'item_id,student_id'});
   if(error)throw error;
  }
  await refresh();redraw();msg(updates.length?'บันทึกคะแนนที่เปลี่ยนแปลง '+updates.length+' ช่องแล้ว':'ไม่มีคะแนนเปลี่ยนแปลง');
 }finally{state.busy=false;if(submit)submit.disabled=false;}
}
function exportCSV(){
 const it=items(),people=students();
 const arr=[['เลขที่','ชื่อ-นามสกุล',...it.map(x=>x.title+' (เต็ม '+x.max_score+')'),'คะแนนถ่วงน้ำหนัก (%)','เกรด','รายการที่บันทึก','รายการทั้งหมด']];
 for(const p of people){
  const r=result(p);
  arr.push([p.student_no,p.full_name,...it.map(i=>gradeEntry(p.id,i.id)?.score??''),
   r.percentage.toFixed(2),r.grade,r.graded,it.length]);
 }
 const quote=x=>'"'+String(x??'').replace(/"/g,'""').replace(/^\s*([=+@\-\t\r])/,"'$1")+'"';
 const csv='\uFEFF'+arr.map(x=>x.map(quote).join(',')).join('\r\n');
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download='สมุดคะแนนออนไลน์.csv';document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function showHistory(){
 const ids=new Set(items().map(x=>x.id));
 const sorted=state.history.filter(x=>ids.has(x.item_id)).sort((a,b)=>String(b.changed_at).localeCompare(String(a.changed_at))).slice(0,100);
 $('historyPane').hidden=false;
 $('historyPane').innerHTML='<div class="row between"><h2>ประวัติแก้ไขคะแนนล่าสุด 100 รายการ</h2>'+
 '<button class="btn" type="button" data-act="hide-history">ปิด</button></div>'+
 (sorted.length?'<div class="scroll"><table><thead><tr><th>วันที่</th><th>นักเรียน</th><th>รายการ</th><th>เดิม</th><th>ใหม่</th></tr></thead><tbody>'+
 sorted.map(x=>'<tr><td>'+h(new Date(x.changed_at).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}))+
 '</td><td>'+h(getName(state.students,x.student_id,'full_name'))+'</td><td>'+h(getName(state.items,x.item_id,'title'))+
 '</td><td>'+h(x.old_score??'-')+'</td><td>'+h(x.new_score??'-')+'</td></tr>').join('')+'</tbody></table></div>':
 '<p class="muted">ยังไม่มีประวัติการแก้ไขคะแนน</p>');
}
async function remove(table,id,warning){
 if(!confirm(warning))return;
 const {error}=await db.from(table).delete().eq('id',id);if(error)throw error;
 await refresh();redraw();msg('ลบข้อมูลเรียบร้อย');
}
$('content').addEventListener('click',event=>{
 const btn=event.target.closest('[data-act]');if(!btn)return;
 const act=btn.dataset.act,id=btn.dataset.id;
 const run=async()=>{
  if(act==='add-category'||act==='edit-category')return categoryModal(id);
  if(act==='add-item'||act==='edit-item')return itemModal(id);
  if(act==='edit-scale')return scaleModal();
  if(act==='csv')return exportCSV();
  if(act==='print')return window.print();
  if(act==='history')return showHistory();
  if(act==='hide-history'){$('historyPane').hidden=true;return;}
  if(act==='delete-category')return remove('grade_categories',id,'ต้องการลบหมวดคะแนนนี้ พร้อมรายการคะแนนและคะแนนนักเรียนทั้งหมดหรือไม่?');
  if(act==='delete-item')return remove('grade_items',id,'ต้องการลบรายการคะแนนและคะแนนทั้งหมดในรายการนี้หรือไม่?');
 };
 run().catch(e=>msg(e.message||String(e),true));
});
$('content').addEventListener('submit',event=>{
 if(event.target.id!=='scoreForm')return;
 event.preventDefault();
 saveGrades(event.target).catch(e=>msg(e.message||String(e),true));
});
$('courseSelect').addEventListener('change',()=>{state.section=$('courseSelect').value;redraw();});
$('reload').addEventListener('click',()=>refresh().then(redraw).catch(e=>msg(e.message||String(e),true)));
$('cancel').addEventListener('click',()=>{state.handler=null;$('editor').close();});
$('editForm').addEventListener('submit',async event=>{
 event.preventDefault();if(state.busy||!state.handler)return;
 state.busy=true;$('save').disabled=true;$('editError').hidden=true;
 try{await state.handler(new FormData(event.target));$('editor').close();msg('บันทึกเรียบร้อย');}
 catch(e){$('editError').textContent=e.message||String(e);$('editError').hidden=false;}
 finally{state.busy=false;$('save').disabled=false;}
});
$('signOut').addEventListener('click',async()=>{await db.auth.signOut();location.href='./';});
$('loginForm').addEventListener('submit',async event=>{
 event.preventDefault();const f=new FormData(event.target);
 const {error}=await db.auth.signInWithPassword({email:String(f.get('email')||'').trim(),password:String(f.get('password')||'')});
 if(error){$('loginError').textContent=error.message;$('loginError').hidden=false;return;}
 $('login').hidden=true;await init();
});
async function init(){
 try{
  const {data,error}=await db.auth.getUser();if(error)throw error;
  state.user=data?.user;
  if(!state.user){$('login').hidden=false;return;}
  const {data:profile,error:profileError}=await db.from('profiles').select('role').eq('id',state.user.id).single();
  if(profileError)throw profileError;
  if(!['admin','teacher'].includes(profile.role)){throw Error('บัญชีนี้ไม่มีสิทธิ์จัดการคะแนน');}
  const {data:student}=await db.from('student_accounts').select('id').eq('user_id',state.user.id).maybeSingle();
  if(student)throw Error('บัญชีนักเรียนไม่สามารถใช้สมุดคะแนนครูได้');
  await refresh();
  $('login').hidden=true;$('content').hidden=false;
  if(!state.sections.length){
   $('categories').innerHTML='<h2>ยังไม่มีรายวิชาที่เปิดสอน</h2><p class="info">เพิ่มห้องเรียนและเปิดสอนรายวิชาใน Teacher Smart Portal ก่อนใช้สมุดคะแนน</p><p><a href="../nexedu/">กลับไปจัดการรายวิชา NEX EDU</a></p>';
   $('gradeTable').hidden=true;$('courseSelect').disabled=true;
   return;
  }
  redraw();
 }catch(e){$('login').hidden=false;$('loginError').textContent='เปิดสมุดคะแนนไม่ได้: '+(e.message||e);$('loginError').hidden=false;}
}
init();