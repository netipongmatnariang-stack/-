
create table if not exists public.teacher_subjects (
 id uuid primary key default gen_random_uuid(),
 name text not null check (char_length(btrim(name)) between 1 and 150),
 subject_code text not null default '' check (char_length(subject_code) <= 40),
 description text not null default '' check (char_length(description) <= 1500),
 sort_order integer not null default 0 check (sort_order between 0 and 100000),
 is_active boolean not null default true,
 created_at timestamptz not null default now()
);
create unique index if not exists teacher_subjects_name_lower_idx on public.teacher_subjects (lower(btrim(name)));
create index if not exists teacher_subjects_sort_idx on public.teacher_subjects (sort_order, name);
alter table public.teacher_subjects enable row level security;
grant select on public.teacher_subjects to anon, authenticated;
grant insert,update,delete on public.teacher_subjects to authenticated;
drop policy if exists teacher_subjects_select on public.teacher_subjects;
create policy teacher_subjects_select on public.teacher_subjects for select to anon,authenticated using (is_active or (select public.is_school_admin()));
drop policy if exists teacher_subjects_insert on public.teacher_subjects;
create policy teacher_subjects_insert on public.teacher_subjects for insert to authenticated with check ((select public.is_school_admin()));
drop policy if exists teacher_subjects_update on public.teacher_subjects;
create policy teacher_subjects_update on public.teacher_subjects for update to authenticated using ((select public.is_school_admin())) with check ((select public.is_school_admin()));
drop policy if exists teacher_subjects_delete on public.teacher_subjects;
create policy teacher_subjects_delete on public.teacher_subjects for delete to authenticated using ((select public.is_school_admin()));
alter table public.worksheets add column if not exists subject_id uuid references public.teacher_subjects(id) on delete set null;
alter table public.assessments add column if not exists subject_id uuid references public.teacher_subjects(id) on delete set null;
create index if not exists worksheets_subject_id_idx on public.worksheets(subject_id);
create index if not exists assessments_subject_id_idx on public.assessments(subject_id);
insert into public.teacher_subjects(name, subject_code, description, sort_order)
select 'วิทยาการคำนวณ','ว 4.2','การคิดเชิงคำนวณ การเขียนโปรแกรมและทักษะดิจิทัล',0
where not exists (select 1 from public.teacher_subjects where lower(btrim(name)) = lower('วิทยาการคำนวณ'));
update public.worksheets w set subject_id=t.id from public.teacher_subjects t
where w.subject_id is null and lower(btrim(w.subject))=lower(btrim(t.name));
