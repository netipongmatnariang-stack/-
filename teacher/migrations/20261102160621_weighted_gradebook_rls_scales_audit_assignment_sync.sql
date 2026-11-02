
create table if not exists public.grade_categories(
 id uuid primary key default gen_random_uuid(),
 section_id uuid not null references public.course_sections(id) on delete cascade,
 name text not null check(char_length(btrim(name)) between 1 and 150),
 weight numeric(6,2) not null default 0 check(weight between 0 and 100),
 sort_order integer not null default 0,
 created_at timestamptz not null default now()
);
create unique index if not exists grade_categories_name_ci on public.grade_categories(section_id,lower(btrim(name)));
create index if not exists grade_categories_section_idx on public.grade_categories(section_id);
create table if not exists public.grade_items(
 id uuid primary key default gen_random_uuid(),
 category_id uuid not null references public.grade_categories(id) on delete cascade,
 title text not null check(char_length(btrim(title)) between 1 and 200),
 max_score numeric(10,2) not null default 10 check(max_score>0 and max_score<=10000),
 task_id uuid unique references public.assignment_tasks(id) on delete set null,
 is_published boolean not null default false,
 created_at timestamptz not null default now()
);
create index if not exists grade_items_category_idx on public.grade_items(category_id);
create table if not exists public.grade_entries(
 item_id uuid not null references public.grade_items(id) on delete cascade,
 student_id uuid not null references public.students(id) on delete cascade,
 score numeric(10,2) check(score is null or score>=0),
 feedback text not null default '',
 updated_by uuid references auth.users(id) on delete set null default auth.uid(),
 updated_at timestamptz not null default now(),
 primary key(item_id,student_id)
);
create index if not exists grade_entries_student_idx on public.grade_entries(student_id);
create table if not exists public.grade_scales(
 id uuid primary key default gen_random_uuid(),
 section_id uuid not null references public.course_sections(id) on delete cascade,
 grade_label text not null check(char_length(btrim(grade_label)) between 1 and 20),
 minimum_percent numeric(5,2) not null check(minimum_percent between 0 and 100),
 unique(section_id,grade_label),
 unique(section_id,minimum_percent)
);
create table if not exists public.grade_history(
 id uuid primary key default gen_random_uuid(),
 item_id uuid not null references public.grade_items(id) on delete cascade,
 student_id uuid not null references public.students(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,
 old_score numeric(10,2),
 new_score numeric(10,2),
 old_feedback text not null default '',
 new_feedback text not null default '',
 changed_at timestamptz not null default now()
);
create index if not exists grade_history_lookup_idx on public.grade_history(item_id,student_id,changed_at desc);
create or replace function app_private.grade_entry_validate_and_timestamp()
returns trigger language plpgsql security invoker set search_path=''
as $$
declare bound numeric;
begin
 select max_score into bound from public.grade_items where id=new.item_id;
 if bound is null then raise exception 'Grade item missing'; end if;
 if new.score is not null and (new.score<0 or new.score>bound) then raise exception 'Score must be between 0 and %',bound; end if;
 new.updated_at=now();
 new.updated_by=auth.uid();
 return new;
end;$$;
drop trigger if exists trg_grade_entry_validate on public.grade_entries;
create trigger trg_grade_entry_validate before insert or update on public.grade_entries
for each row execute function app_private.grade_entry_validate_and_timestamp();
create or replace function app_private.grade_audit_record()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if tg_op='INSERT' then
  insert into public.grade_history(item_id,student_id,actor_id,old_score,new_score,old_feedback,new_feedback)
  values(new.item_id,new.student_id,auth.uid(),null,new.score,'',new.feedback);
 elsif tg_op='UPDATE' then
  if old.score is distinct from new.score or old.feedback is distinct from new.feedback then
   insert into public.grade_history(item_id,student_id,actor_id,old_score,new_score,old_feedback,new_feedback)
   values(new.item_id,new.student_id,auth.uid(),old.score,new.score,old.feedback,new.feedback);
  end if;
 elsif tg_op='DELETE' then
  insert into public.grade_history(item_id,student_id,actor_id,old_score,new_score,old_feedback,new_feedback)
  values(old.item_id,old.student_id,auth.uid(),old.score,null,old.feedback,'');
 end if;
 return null;
end;$$;
revoke all on function app_private.grade_entry_validate_and_timestamp() from public,anon;
revoke all on function app_private.grade_audit_record() from public,anon,authenticated;
drop trigger if exists trg_grade_audit on public.grade_entries;
create trigger trg_grade_audit after insert or update on public.grade_entries
for each row execute function app_private.grade_audit_record();
-- Do not audit DELETE in this trigger because grade_history may be cascade-deleted in the same transaction.
alter table public.grade_categories enable row level security;
alter table public.grade_items enable row level security;
alter table public.grade_entries enable row level security;
alter table public.grade_scales enable row level security;
alter table public.grade_history enable row level security;
revoke all on public.grade_categories,public.grade_items,public.grade_entries,public.grade_scales,public.grade_history from public,anon,authenticated;
grant select,insert,update,delete on public.grade_categories,public.grade_items,public.grade_entries,public.grade_scales to authenticated;
grant select on public.grade_history to authenticated;
create policy grade_categories_select on public.grade_categories for select to authenticated using(
 exists(select 1 from public.course_sections c where c.id=grade_categories.section_id)
);
create policy grade_categories_insert on public.grade_categories for insert to authenticated with check(
 exists(select 1 from public.course_sections c where c.id=section_id and public.can_access_school_class(c.class_id))
);
create policy grade_categories_update on public.grade_categories for update to authenticated using(
 exists(select 1 from public.course_sections c where c.id=section_id and public.can_access_school_class(c.class_id))
) with check(exists(select 1 from public.course_sections c where c.id=section_id and public.can_access_school_class(c.class_id)));
create policy grade_categories_delete on public.grade_categories for delete to authenticated using(
 exists(select 1 from public.course_sections c where c.id=section_id and public.can_access_school_class(c.class_id))
);
create policy grade_items_select on public.grade_items for select to authenticated using(
 exists(select 1 from public.grade_categories gc join public.course_sections cs on cs.id=gc.section_id
 where gc.id=grade_items.category_id and
 (public.can_access_school_class(cs.class_id) or (cs.is_published and grade_items.is_published)))
);
create policy grade_items_insert on public.grade_items for insert to authenticated with check(
 exists(select 1 from public.grade_categories gc join public.course_sections cs on cs.id=gc.section_id
 where gc.id=category_id and public.can_access_school_class(cs.class_id))
);
create policy grade_items_update on public.grade_items for update to authenticated using(
 exists(select 1 from public.grade_categories gc join public.course_sections cs on cs.id=gc.section_id
 where gc.id=category_id and public.can_access_school_class(cs.class_id))
) with check(exists(select 1 from public.grade_categories gc join public.course_sections cs on cs.id=gc.section_id
 where gc.id=category_id and public.can_access_school_class(cs.class_id)));
create policy grade_items_delete on public.grade_items for delete to authenticated using(
 exists(select 1 from public.grade_categories gc join public.course_sections cs on cs.id=gc.section_id
 where gc.id=category_id and public.can_access_school_class(cs.class_id))
);
create policy grade_entries_select on public.grade_entries for select to authenticated using(
 exists(select 1 from public.grade_items gi join public.grade_categories gc on gc.id=gi.category_id
 join public.course_sections cs on cs.id=gc.section_id
 where gi.id=grade_entries.item_id and
 (public.can_access_school_class(cs.class_id) or
 (cs.is_published and gi.is_published and
 exists(select 1 from public.student_accounts sa where sa.student_id=grade_entries.student_id
 and sa.class_id=cs.class_id and sa.user_id=(select auth.uid())))))
);
create policy grade_entries_insert on public.grade_entries for insert to authenticated with check(
 exists(select 1 from public.grade_items gi join public.grade_categories gc on gc.id=gi.category_id
 join public.course_sections cs on cs.id=gc.section_id join public.students st on st.class_id=cs.class_id
 where gi.id=item_id and st.id=student_id and public.can_access_school_class(cs.class_id))
);
create policy grade_entries_update on public.grade_entries for update to authenticated using(
 exists(select 1 from public.grade_items gi join public.grade_categories gc on gc.id=gi.category_id
 join public.course_sections cs on cs.id=gc.section_id
 where gi.id=item_id and public.can_access_school_class(cs.class_id))
) with check(exists(select 1 from public.grade_items gi join public.grade_categories gc on gc.id=gi.category_id
 join public.course_sections cs on cs.id=gc.section_id join public.students st on st.class_id=cs.class_id
 where gi.id=item_id and st.id=student_id and public.can_access_school_class(cs.class_id)));
create policy grade_entries_delete on public.grade_entries for delete to authenticated using(
 exists(select 1 from public.grade_items gi join public.grade_categories gc on gc.id=gi.category_id
 join public.course_sections cs on cs.id=gc.section_id
 where gi.id=item_id and public.can_access_school_class(cs.class_id))
);
create policy grade_scales_select on public.grade_scales for select to authenticated using(
 exists(select 1 from public.course_sections c where c.id=grade_scales.section_id)
);
create policy grade_scales_insert on public.grade_scales for insert to authenticated with check(
 exists(select 1 from public.course_sections c where c.id=section_id and public.can_access_school_class(c.class_id))
);
create policy grade_scales_update on public.grade_scales for update to authenticated using(
 exists(select 1 from public.course_sections c where c.id=section_id and public.can_access_school_class(c.class_id))
) with check(exists(select 1 from public.course_sections c where c.id=section_id and public.can_access_school_class(c.class_id)));
create policy grade_scales_delete on public.grade_scales for delete to authenticated using(
 exists(select 1 from public.course_sections c where c.id=section_id and public.can_access_school_class(c.class_id))
);
create policy grade_history_teacher_select on public.grade_history for select to authenticated using(
 exists(select 1 from public.grade_items gi join public.grade_categories gc on gc.id=gi.category_id
 join public.course_sections cs on cs.id=gc.section_id where gi.id=grade_history.item_id
 and public.can_access_school_class(cs.class_id))
);
-- default grade scales attached at creation of each new course section
create or replace function app_private.seed_default_grade_scales()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 insert into public.grade_scales(section_id,grade_label,minimum_percent)
 values(new.id,'4',80),(new.id,'3.5',75),(new.id,'3',70),(new.id,'2.5',65),
       (new.id,'2',60),(new.id,'1.5',55),(new.id,'1',50),(new.id,'0',0)
 on conflict do nothing;
 return new;
end;$$;
revoke all on function app_private.seed_default_grade_scales() from public,anon,authenticated;
drop trigger if exists trg_default_grade_scales on public.course_sections;
create trigger trg_default_grade_scales after insert on public.course_sections
for each row execute function app_private.seed_default_grade_scales();
-- backfill existing sections if any
insert into public.grade_scales(section_id,grade_label,minimum_percent)
select cs.id,v.label,v.cutoff from public.course_sections cs
cross join (values('4',80),('3.5',75),('3',70),('2.5',65),('2',60),('1.5',55),('1',50),('0',0)) v(label,cutoff)
on conflict do nothing;
-- existing assignment reviews automatically synchronize to gradebook items explicitly linked to a task
create or replace function app_private.sync_review_gradebook()
returns trigger language plpgsql security definer set search_path=''
as $$
declare sub record;
begin
 select task_id,student_id into sub from public.assignment_submissions where id=new.submission_id;
 if not found then return new;end if;
 insert into public.grade_entries(item_id,student_id,score,feedback)
 select gi.id,sub.student_id,new.score,new.feedback
 from public.grade_items gi where gi.task_id=sub.task_id
 on conflict(item_id,student_id) do update set score=excluded.score,feedback=excluded.feedback;
 return new;
end;$$;
revoke all on function app_private.sync_review_gradebook() from public,anon,authenticated;
drop trigger if exists trg_review_to_gradebook on public.assignment_reviews;
create trigger trg_review_to_gradebook after insert or update of score,feedback,status on public.assignment_reviews
for each row execute function app_private.sync_review_gradebook();
