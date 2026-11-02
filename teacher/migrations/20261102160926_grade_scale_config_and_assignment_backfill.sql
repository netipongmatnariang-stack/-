
create or replace function public.set_course_grade_scales(p_section uuid,p_scales jsonb)
returns void language plpgsql security invoker set search_path=''
as $$
declare labels text[]:=array['4','3.5','3','2.5','2','1.5','1','0'];
declare i integer;
declare current_min numeric;
declare prior numeric:=101;
declare entry jsonb;
begin
 if not exists(select 1 from public.course_sections cs where cs.id=p_section and public.can_access_school_class(cs.class_id))
 then raise exception 'Permission denied for course';end if;
 if jsonb_typeof(p_scales)<>'array' or jsonb_array_length(p_scales)<>8 then
  raise exception 'Eight grade levels required';
 end if;
 for i in 1..8 loop
  entry:=p_scales->(i-1);
  if entry->>'grade_label' is distinct from labels[i] then raise exception 'Unexpected grade level';end if;
  current_min:=(entry->>'minimum_percent')::numeric;
  if current_min<0 or current_min>100 or current_min>=prior then raise exception 'Minimum percentages must strictly decrease';end if;
  prior:=current_min;
 end loop;
 if prior<>0 then raise exception 'Grade 0 minimum must be zero'; end if;
 delete from public.grade_scales where section_id=p_section;
 insert into public.grade_scales(section_id,grade_label,minimum_percent)
 select p_section,z->>'grade_label',(z->>'minimum_percent')::numeric
 from jsonb_array_elements(p_scales) z;
end;$$;
revoke all on function public.set_course_grade_scales(uuid,jsonb) from public,anon;
grant execute on function public.set_course_grade_scales(uuid,jsonb) to authenticated;
create or replace function app_private.validate_linked_grade_item()
returns trigger language plpgsql security invoker set search_path=''
as $$
declare grade_course uuid;
declare task_course uuid;
begin
 if new.task_id is null then return new;end if;
 select section_id into grade_course from public.grade_categories where id=new.category_id;
 select section_id into task_course from public.assignment_tasks where id=new.task_id;
 if grade_course is null or task_course is null or grade_course<>task_course then
  raise exception 'Linked assignment must belong to the same course';
 end if;
 return new;
end;$$;
drop trigger if exists trg_grade_item_task_check on public.grade_items;
create trigger trg_grade_item_task_check before insert or update on public.grade_items
for each row execute function app_private.validate_linked_grade_item();
create or replace function app_private.backfill_grade_task_review()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if new.task_id is null then return new;end if;
 insert into public.grade_entries(item_id,student_id,score,feedback)
 select new.id,s.student_id,r.score,r.feedback
 from public.assignment_submissions s
 join public.assignment_reviews r on r.submission_id=s.id
 where s.task_id=new.task_id
 on conflict(item_id,student_id) do update set score=excluded.score, feedback=excluded.feedback;
 return new;
end;$$;
revoke all on function app_private.backfill_grade_task_review() from public,anon,authenticated;
drop trigger if exists trg_grade_linked_backfill on public.grade_items;
create trigger trg_grade_linked_backfill after insert or update of task_id on public.grade_items
for each row execute function app_private.backfill_grade_task_review();
