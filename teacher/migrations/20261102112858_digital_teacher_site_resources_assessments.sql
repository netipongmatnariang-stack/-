-- ครูเนติพงษ์: Personal digital classroom, public content and private assessment
create table if not exists public.teacher_site (
  id int primary key default 1 check (id = 1),
  site_title text not null default 'ห้องเรียนดิจิทัล',
  teacher_name text not null default 'ครูเนติพงษ์ มาตนาเรียง',
  tagline text not null default 'เรียนรู้ สนุกคิด และเติบโตไปด้วยกัน',
  introduction text not null default 'พื้นที่รวมสื่อการเรียนรู้ ใบงาน และกิจกรรมวิทยาการคำนวณ โรงเรียนบ้านหินลาด',
  subject text not null default 'วิทยาศาสตร์และเทคโนโลยี · วิทยาการคำนวณ',
  updated_at timestamptz not null default now(),
  constraint teacher_site_text check (
    length(site_title) <= 150 and length(teacher_name) <= 150 and
    length(tagline) <= 300 and length(introduction) <= 3000 and length(subject) <= 300
  )
);
insert into public.teacher_site(id) values (1) on conflict (id) do nothing;

create table if not exists public.worksheets (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 240),
  description text not null default '' check (length(description) <= 3000),
  subject text not null default '' check (length(subject) <= 150),
  grade_label text not null default '' check (length(grade_label) <= 100),
  file_path text,
  external_url text,
  is_published boolean not null default false,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint worksheet_has_source check (file_path is not null or external_url is not null),
  constraint worksheet_url check (external_url is null or external_url ~ '^https://'),
  constraint worksheet_path check (file_path is null or length(file_path) <= 500)
);
create index if not exists worksheets_pub_idx on public.worksheets(is_published,created_at desc);

create table if not exists public.teacher_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 200),
  body text not null default '' check (length(body) <= 3000),
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists teacher_announcements_pub_idx on public.teacher_announcements(is_published,created_at desc);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.school_classes(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  category text not null default 'worksheet'
    check (category in ('worksheet','quiz','assignment','activity','other')),
  max_score numeric(7,2) not null default 10 check (max_score > 0 and max_score <= 10000),
  assessment_date date not null default current_date,
  details text not null default '' check (length(details) <= 1000),
  created_at timestamptz not null default now()
);
create index if not exists assessments_class_date_idx on public.assessments(class_id,assessment_date desc);

create table if not exists public.assessment_scores (
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  score numeric(7,2) check (score is null or score >= 0),
  feedback text not null default '' check (length(feedback) <= 1000),
  updated_at timestamptz not null default now(),
  primary key (assessment_id,student_id)
);
create index if not exists assessment_scores_student_idx on public.assessment_scores(student_id);

create or replace function public.validate_assessment_score()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  class_of_assessment uuid;
  class_of_student uuid;
  score_max numeric;
begin
  select a.class_id,a.max_score into class_of_assessment,score_max
  from public.assessments a where a.id = new.assessment_id;
  select s.class_id into class_of_student
  from public.students s where s.id = new.student_id;
  if class_of_assessment is null or class_of_student is null or class_of_assessment <> class_of_student then
    raise exception 'Student and assessment must belong to the same class';
  end if;
  if new.score is not null and new.score > score_max then
    raise exception 'Score cannot exceed maximum score';
  end if;
  new.updated_at = now();
  return new;
end $$;
revoke all on function public.validate_assessment_score() from public,anon,authenticated;
drop trigger if exists validate_score on public.assessment_scores;
create trigger validate_score
  before insert or update on public.assessment_scores
  for each row execute function public.validate_assessment_score();

alter table public.teacher_site enable row level security;
alter table public.worksheets enable row level security;
alter table public.teacher_announcements enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_scores enable row level security;

grant select on public.teacher_site,public.worksheets,public.teacher_announcements to anon;
grant select,insert,update,delete on public.teacher_site,public.worksheets,
  public.teacher_announcements,public.assessments,public.assessment_scores to authenticated;
revoke all on public.assessments,public.assessment_scores from anon;

create policy "teacher_site_public_read" on public.teacher_site
for select to anon,authenticated using (true);
create policy "teacher_site_admin_update" on public.teacher_site
for update to authenticated using (public.is_school_admin()) with check (public.is_school_admin());

create policy "worksheets_public_read" on public.worksheets
for select to anon,authenticated using (is_published or (select public.is_school_admin()));
create policy "worksheets_admin_insert" on public.worksheets
for insert to authenticated with check ((select public.is_school_admin()));
create policy "worksheets_admin_update" on public.worksheets
for update to authenticated using ((select public.is_school_admin()))
with check ((select public.is_school_admin()));
create policy "worksheets_admin_delete" on public.worksheets
for delete to authenticated using ((select public.is_school_admin()));

create policy "announcements_public_read" on public.teacher_announcements
for select to anon,authenticated using (is_published or (select public.is_school_admin()));
create policy "announcements_admin_insert" on public.teacher_announcements
for insert to authenticated with check ((select public.is_school_admin()));
create policy "announcements_admin_update" on public.teacher_announcements
for update to authenticated using ((select public.is_school_admin()))
with check ((select public.is_school_admin()));
create policy "announcements_admin_delete" on public.teacher_announcements
for delete to authenticated using ((select public.is_school_admin()));

create policy "assessments_access_select" on public.assessments
for select to authenticated using (public.can_access_school_class(class_id));
create policy "assessments_access_insert" on public.assessments
for insert to authenticated with check (public.can_access_school_class(class_id));
create policy "assessments_access_update" on public.assessments
for update to authenticated using (public.can_access_school_class(class_id))
with check (public.can_access_school_class(class_id));
create policy "assessments_access_delete" on public.assessments
for delete to authenticated using (public.can_access_school_class(class_id));

create policy "assessment_scores_access_select" on public.assessment_scores
for select to authenticated using (
  exists (select 1 from public.assessments a
    where a.id=assessment_id and public.can_access_school_class(a.class_id))
);
create policy "assessment_scores_access_insert" on public.assessment_scores
for insert to authenticated with check (
  exists (select 1 from public.assessments a
    where a.id=assessment_id and public.can_access_school_class(a.class_id))
);
create policy "assessment_scores_access_update" on public.assessment_scores
for update to authenticated using (
  exists (select 1 from public.assessments a
    where a.id=assessment_id and public.can_access_school_class(a.class_id))
) with check (
  exists (select 1 from public.assessments a
    where a.id=assessment_id and public.can_access_school_class(a.class_id))
);
create policy "assessment_scores_access_delete" on public.assessment_scores
for delete to authenticated using (
  exists (select 1 from public.assessments a
    where a.id=assessment_id and public.can_access_school_class(a.class_id))
);

-- Public worksheet downloads are deliberately readable by anyone with URL.
-- Never upload student work containing personal details to this bucket.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('teacher-worksheets','teacher-worksheets',true,10485760,
  array['application/pdf','image/png','image/jpeg',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public=true,file_size_limit=10485760,
  allowed_mime_types=excluded.allowed_mime_types;

create policy "teacher_worksheets_admin_upload" on storage.objects
for insert to authenticated
with check (bucket_id='teacher-worksheets' and (select public.is_school_admin()));
create policy "teacher_worksheets_admin_select" on storage.objects
for select to authenticated
using (bucket_id='teacher-worksheets' and (select public.is_school_admin()));
create policy "teacher_worksheets_admin_delete" on storage.objects
for delete to authenticated
using (bucket_id='teacher-worksheets' and (select public.is_school_admin()));

-- Announcement and worksheet public visibility is intentional; private marks never exposed.
