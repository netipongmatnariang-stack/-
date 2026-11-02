
-- Teacher Smart Portal: integrated academic, student, PA and portfolio foundations.
create table if not exists public.academic_terms(
 id uuid primary key default gen_random_uuid(),
 academic_year integer not null check (academic_year between 2500 and 2700),
 term_no integer not null check (term_no between 1 and 3),
 term_name text not null default '',
 starts_on date,
 ends_on date,
 is_current boolean not null default false,
 unique(academic_year,term_no)
);
create table if not exists public.student_accounts(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references auth.users(id) on delete cascade,
 student_id uuid not null unique references public.students(id) on delete cascade,
 class_id uuid not null references public.school_classes(id) on delete cascade,
 created_at timestamptz not null default now()
);
create index if not exists student_accounts_class_idx on public.student_accounts(class_id);
create table if not exists public.course_sections(
 id uuid primary key default gen_random_uuid(),
 subject_id uuid not null references public.teacher_subjects(id) on delete restrict,
 class_id uuid not null references public.school_classes(id) on delete cascade,
 term_id uuid not null references public.academic_terms(id) on delete restrict,
 periods_per_week integer not null default 1 check(periods_per_week between 1 and 30),
 minimum_attendance numeric(5,2) not null default 80 check(minimum_attendance between 0 and 100),
 late_weight numeric(3,2) not null default 1 check(late_weight between 0 and 1),
 leave_weight numeric(3,2) not null default 0 check(leave_weight between 0 and 1),
 is_published boolean not null default false,
 created_at timestamptz not null default now(),
 unique(subject_id,class_id,term_id)
);
create index if not exists course_sections_class_idx on public.course_sections(class_id);
create index if not exists course_sections_term_idx on public.course_sections(term_id);
create table if not exists public.course_units(
 id uuid primary key default gen_random_uuid(),
 section_id uuid not null references public.course_sections(id) on delete cascade,
 sequence_no integer not null default 1 check(sequence_no between 1 and 10000),
 title text not null check(char_length(btrim(title)) between 1 and 200),
 summary text not null default '',
 resource_url text not null default '',
 is_published boolean not null default false,
 unique(section_id,sequence_no)
);
create index if not exists course_units_section_idx on public.course_units(section_id);
create table if not exists public.teaching_sessions(
 id uuid primary key default gen_random_uuid(),
 section_id uuid not null references public.course_sections(id) on delete cascade,
 session_date date not null default current_date,
 period_no integer not null default 1 check(period_no between 1 and 20),
 topic text not null default '',
 minutes integer not null default 60 check(minutes between 1 and 240),
 is_held boolean not null default true,
 unique(section_id,session_date,period_no)
);
create index if not exists teaching_sessions_section_idx on public.teaching_sessions(section_id);
create table if not exists public.period_attendance(
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references public.teaching_sessions(id) on delete cascade,
 student_id uuid not null references public.students(id) on delete cascade,
 status text not null check(status in ('present','absent','late','sick','personal','other')),
 note text not null default '',
 updated_at timestamptz not null default now(),
 unique(session_id,student_id)
);
create index if not exists period_attendance_student_idx on public.period_attendance(student_id);
create table if not exists public.assignment_tasks(
 id uuid primary key default gen_random_uuid(),
 section_id uuid not null references public.course_sections(id) on delete cascade,
 title text not null check(char_length(btrim(title)) between 1 and 250),
 instructions text not null default '',
 resource_url text not null default '',
 due_at timestamptz,
 max_score numeric(10,2) not null default 10 check(max_score > 0 and max_score <= 10000),
 is_published boolean not null default false,
 allow_resubmit boolean not null default true,
 created_at timestamptz not null default now()
);
create index if not exists assignment_tasks_section_idx on public.assignment_tasks(section_id);
create table if not exists public.assignment_submissions(
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null references public.assignment_tasks(id) on delete cascade,
 student_id uuid not null references public.students(id) on delete cascade,
 file_path text not null default '',
 note text not null default '',
 submitted_at timestamptz not null default now(),
 unique(task_id,student_id)
);
create index if not exists assignment_submissions_student_idx on public.assignment_submissions(student_id);
create table if not exists public.assignment_reviews(
 submission_id uuid primary key references public.assignment_submissions(id) on delete cascade,
 score numeric(10,2) check(score >= 0),
 feedback text not null default '',
 status text not null default 'pending' check(status in ('pending','graded','revision')),
 reviewed_at timestamptz not null default now()
);
create table if not exists public.pa_cycles(
 id uuid primary key default gen_random_uuid(),
 fiscal_year integer not null unique check(fiscal_year between 2500 and 2700),
 title text not null default 'แบบข้อตกลงในการพัฒนางาน (PA)',
 starts_on date not null,
 ends_on date not null,
 challenge_title text not null default '',
 challenge_description text not null default '',
 created_at timestamptz not null default now()
);
create table if not exists public.pa_indicators(
 id uuid primary key default gen_random_uuid(),
 code text not null unique,
 area_no integer not null check(area_no between 1 and 3),
 title text not null
);
create table if not exists public.pa_evidence(
 id uuid primary key default gen_random_uuid(),
 cycle_id uuid not null references public.pa_cycles(id) on delete cascade,
 indicator_id uuid references public.pa_indicators(id) on delete set null,
 title text not null check(char_length(btrim(title)) between 1 and 250),
 description text not null default '',
 evidence_url text not null default '',
 evidence_date date not null default current_date,
 created_at timestamptz not null default now()
);
create index if not exists pa_evidence_cycle_idx on public.pa_evidence(cycle_id);
create table if not exists public.teacher_portfolio(
 id uuid primary key default gen_random_uuid(),
 category text not null check(category in ('photo','video','certificate','award','research','innovation','training','other')),
 title text not null check(char_length(btrim(title)) between 1 and 250),
 description text not null default '',
 event_date date,
 image_url text not null default '',
 link_url text not null default '',
 is_published boolean not null default false,
 created_at timestamptz not null default now()
);
create index if not exists teacher_portfolio_published_idx on public.teacher_portfolio(is_published,event_date);
-- Set classroom sessions as academic-year 2569 term 2 starting record, without invented student/attendance.
insert into public.academic_terms(academic_year,term_no,term_name,is_current)
select 2569,2,'ภาคเรียนที่ 2 ปีการศึกษา 2569',true
where not exists(select 1 from public.academic_terms where academic_year=2569 and term_no=2);
insert into public.pa_cycles(fiscal_year,starts_on,ends_on)
select 2570,date '2026-10-01',date '2027-09-30'
where not exists(select 1 from public.pa_cycles where fiscal_year=2570);
insert into public.pa_indicators(code,area_no,title)
values 
('1.1',1,'สร้างและหรือพัฒนาหลักสูตร'),
('1.2',1,'ออกแบบการจัดการเรียนรู้'),
('1.3',1,'จัดกิจกรรมการเรียนรู้'),
('1.4',1,'สร้างและหรือพัฒนาสื่อ นวัตกรรม เทคโนโลยี และแหล่งเรียนรู้'),
('1.5',1,'วัดและประเมินผลการเรียนรู้'),
('1.6',1,'ศึกษา วิเคราะห์ และสังเคราะห์เพื่อแก้ไขปัญหาหรือพัฒนาการเรียนรู้'),
('1.7',1,'จัดบรรยากาศที่ส่งเสริมและพัฒนาผู้เรียน'),
('1.8',1,'อบรมและพัฒนาคุณลักษณะที่ดีของผู้เรียน'),
('2.1',2,'จัดทำข้อมูลสารสนเทศของผู้เรียนและรายวิชา'),
('2.2',2,'ดำเนินการตามระบบดูแลช่วยเหลือผู้เรียน'),
('2.3',2,'ปฏิบัติงานวิชาการและงานอื่น ๆ ของสถานศึกษา'),
('2.4',2,'ประสานความร่วมมือกับผู้ปกครอง ภาคีเครือข่าย หรือสถานประกอบการ'),
('3.1',3,'พัฒนาตนเองอย่างเป็นระบบและต่อเนื่อง'),
('3.2',3,'มีส่วนร่วมในการแลกเปลี่ยนเรียนรู้ทางวิชาชีพ'),
('3.3',3,'นำความรู้และทักษะจากการพัฒนาตนเองและวิชาชีพมาใช้พัฒนาการจัดการเรียนรู้ คุณภาพผู้เรียน และนวัตกรรม')
on conflict(code) do nothing;
-- All new tables use RLS. Public visitors never see student/private records.
alter table public.academic_terms enable row level security;
alter table public.student_accounts enable row level security;
alter table public.course_sections enable row level security;
alter table public.course_units enable row level security;
alter table public.teaching_sessions enable row level security;
alter table public.period_attendance enable row level security;
alter table public.assignment_tasks enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.assignment_reviews enable row level security;
alter table public.pa_cycles enable row level security;
alter table public.pa_indicators enable row level security;
alter table public.pa_evidence enable row level security;
alter table public.teacher_portfolio enable row level security;
revoke all on public.academic_terms,public.student_accounts,public.course_sections,public.course_units,public.teaching_sessions,public.period_attendance,public.assignment_tasks,public.assignment_submissions,public.assignment_reviews,public.pa_cycles,public.pa_indicators,public.pa_evidence,public.teacher_portfolio from public,anon,authenticated;
grant select on public.academic_terms,public.student_accounts,public.course_sections,public.course_units,public.teaching_sessions,public.period_attendance,public.assignment_tasks,public.assignment_submissions,public.assignment_reviews,public.pa_cycles,public.pa_indicators,public.pa_evidence,public.teacher_portfolio to authenticated;
grant insert,update,delete on public.academic_terms,public.student_accounts,public.course_sections,public.course_units,public.teaching_sessions,public.period_attendance,public.assignment_tasks,public.assignment_submissions,public.assignment_reviews,public.pa_cycles,public.pa_indicators,public.pa_evidence,public.teacher_portfolio to authenticated;
grant select on public.teacher_portfolio to anon;
-- public portfolio read
create policy portfolio_public_read on public.teacher_portfolio for select to anon,authenticated using(is_published or (select public.is_school_admin()));
create policy portfolio_admin_insert on public.teacher_portfolio for insert to authenticated with check ((select public.is_school_admin()));
create policy portfolio_admin_update on public.teacher_portfolio for update to authenticated using ((select public.is_school_admin())) with check ((select public.is_school_admin()));
create policy portfolio_admin_delete on public.teacher_portfolio for delete to authenticated using ((select public.is_school_admin()));
-- admin-only cycles/indicators/evidence (PA reviewer sharing will be implemented through an explicit scoped permission flow later)
create policy pa_cycles_admin_select on public.pa_cycles for select to authenticated using ((select public.is_school_admin()));
create policy pa_cycles_admin_insert on public.pa_cycles for insert to authenticated with check ((select public.is_school_admin()));
create policy pa_cycles_admin_update on public.pa_cycles for update to authenticated using ((select public.is_school_admin())) with check ((select public.is_school_admin()));
create policy pa_cycles_admin_delete on public.pa_cycles for delete to authenticated using ((select public.is_school_admin()));
create policy pa_indicators_admin_select on public.pa_indicators for select to authenticated using ((select public.is_school_admin()));
create policy pa_indicators_admin_insert on public.pa_indicators for insert to authenticated with check ((select public.is_school_admin()));
create policy pa_indicators_admin_update on public.pa_indicators for update to authenticated using ((select public.is_school_admin())) with check ((select public.is_school_admin()));
create policy pa_indicators_admin_delete on public.pa_indicators for delete to authenticated using ((select public.is_school_admin()));
create policy pa_evidence_admin_select on public.pa_evidence for select to authenticated using ((select public.is_school_admin()));
create policy pa_evidence_admin_insert on public.pa_evidence for insert to authenticated with check ((select public.is_school_admin()));
create policy pa_evidence_admin_update on public.pa_evidence for update to authenticated using ((select public.is_school_admin())) with check ((select public.is_school_admin()));
create policy pa_evidence_admin_delete on public.pa_evidence for delete to authenticated using ((select public.is_school_admin()));
-- student identity linking (read own; only admins may link an Auth account to a student)
create policy student_accounts_read on public.student_accounts for select to authenticated
using(user_id=(select auth.uid()) or (select public.is_school_admin()));
create policy student_accounts_admin_insert on public.student_accounts for insert to authenticated with check ((select public.is_school_admin()));
create policy student_accounts_admin_update on public.student_accounts for update to authenticated using ((select public.is_school_admin())) with check ((select public.is_school_admin()));
create policy student_accounts_admin_delete on public.student_accounts for delete to authenticated using ((select public.is_school_admin()));
-- students may view their own student profile only
create policy students_self_read on public.students for select to authenticated
using(exists(select 1 from public.student_accounts sa where sa.student_id=students.id and sa.user_id=(select auth.uid())));
-- existing assessment records/grades and daily attendance readable by their matching student only
create policy student_assessments_read on public.assessments for select to authenticated
using(exists(select 1 from public.student_accounts sa where sa.class_id=assessments.class_id and sa.user_id=(select auth.uid())));
create policy student_scores_read on public.assessment_scores for select to authenticated
using(exists(select 1 from public.student_accounts sa where sa.student_id=assessment_scores.student_id and sa.user_id=(select auth.uid())));
create policy student_attendance_read on public.attendance for select to authenticated
using(exists(select 1 from public.student_accounts sa where sa.student_id=attendance.student_id and sa.user_id=(select auth.uid())));
-- terms accessible to signed in teachers and linked students
create policy academic_terms_read on public.academic_terms for select to authenticated
using((select public.is_school_admin()) or exists(select 1 from public.class_teachers ct where ct.teacher_id=(select auth.uid())) or exists(select 1 from public.student_accounts sa where sa.user_id=(select auth.uid())));
create policy academic_terms_insert on public.academic_terms for insert to authenticated with check ((select public.is_school_admin()));
create policy academic_terms_update on public.academic_terms for update to authenticated using ((select public.is_school_admin())) with check ((select public.is_school_admin()));
create policy academic_terms_delete on public.academic_terms for delete to authenticated using ((select public.is_school_admin()));
-- class access for teachers; only explicitly published sections accessible to student in class
create policy course_sections_read on public.course_sections for select to authenticated
using(public.can_access_school_class(class_id) or (is_published and exists(select 1 from public.student_accounts sa where sa.class_id=course_sections.class_id and sa.user_id=(select auth.uid()))));
create policy course_sections_insert on public.course_sections for insert to authenticated with check(public.can_access_school_class(class_id));
create policy course_sections_update on public.course_sections for update to authenticated using(public.can_access_school_class(class_id)) with check(public.can_access_school_class(class_id));
create policy course_sections_delete on public.course_sections for delete to authenticated using(public.can_access_school_class(class_id));
create policy course_units_read on public.course_units for select to authenticated
using(exists(select 1 from public.course_sections cs where cs.id=section_id and (public.can_access_school_class(cs.class_id) or (is_published and cs.is_published))));
create policy course_units_insert on public.course_units for insert to authenticated with check(exists(select 1 from public.course_sections cs where cs.id=section_id and public.can_access_school_class(cs.class_id)));
create policy course_units_update on public.course_units for update to authenticated using(exists(select 1 from public.course_sections cs where cs.id=section_id and public.can_access_school_class(cs.class_id))) with check(exists(select 1 from public.course_sections cs where cs.id=section_id and public.can_access_school_class(cs.class_id)));
create policy course_units_delete on public.course_units for delete to authenticated using(exists(select 1 from public.course_sections cs where cs.id=section_id and public.can_access_school_class(cs.class_id)));
create policy teaching_sessions_read on public.teaching_sessions for select to authenticated
using(exists(select 1 from public.course_sections cs where cs.id=section_id));
create policy teaching_sessions_insert on public.teaching_sessions for insert to authenticated
with check(exists(select 1 from public.course_sections cs where cs.id=section_id and public.can_access_school_class(cs.class_id)));
create policy teaching_sessions_update on public.teaching_sessions for update to authenticated
using(exists(select 1 from public.course_sections cs where cs.id=section_id and public.can_access_school_class(cs.class_id)))
with check(exists(select 1 from public.course_sections cs where cs.id=section_id and public.can_access_school_class(cs.class_id)));
create policy teaching_sessions_delete on public.teaching_sessions for delete to authenticated
using(exists(select 1 from public.course_sections cs where cs.id=section_id and public.can_access_school_class(cs.class_id)));
create policy period_attendance_read on public.period_attendance for select to authenticated
using(exists(select 1 from public.student_accounts sa where sa.student_id=period_attendance.student_id and sa.user_id=(select auth.uid())) or
exists(select 1 from public.teaching_sessions ts join public.course_sections cs on cs.id=ts.section_id where ts.id=period_attendance.session_id and public.can_access_school_class(cs.class_id)));
create policy period_attendance_insert on public.period_attendance for insert to authenticated with check
(exists(select 1 from public.teaching_sessions ts join public.course_sections cs on cs.id=ts.section_id join public.students st on st.class_id=cs.class_id and st.id=period_attendance.student_id where ts.id=period_attendance.session_id and public.can_access_school_class(cs.class_id)));
create policy period_attendance_update on public.period_attendance for update to authenticated using
(exists(select 1 from public.teaching_sessions ts join public.course_sections cs on cs.id=ts.section_id where ts.id=period_attendance.session_id and public.can_access_school_class(cs.class_id))) with check
(exists(select 1 from public.teaching_sessions ts join public.course_sections cs on cs.id=ts.section_id join public.students st on st.class_id=cs.class_id and st.id=period_attendance.student_id where ts.id=period_attendance.session_id and public.can_access_school_class(cs.class_id)));
create policy period_attendance_delete on public.period_attendance for delete to authenticated using
(exists(select 1 from public.teaching_sessions ts join public.course_sections cs on cs.id=ts.section_id where ts.id=period_attendance.session_id and public.can_access_school_class(cs.class_id)));
create policy assignment_tasks_read on public.assignment_tasks for select to authenticated
using(exists(select 1 from public.course_sections cs where cs.id=section_id and (public.can_access_school_class(cs.class_id) or (cs.is_published and assignment_tasks.is_published))));
create policy assignment_tasks_insert on public.assignment_tasks for insert to authenticated
with check(exists(select 1 from public.course_sections cs where cs.id=section_id and public.can_access_school_class(cs.class_id)));
create policy assignment_tasks_update on public.assignment_tasks for update to authenticated
using(exists(select 1 from public.course_sections cs where cs.id=section_id and public.can_access_school_class(cs.class_id)))
with check(exists(select 1 from public.course_sections cs where cs.id=section_id and public.can_access_school_class(cs.class_id)));
create policy assignment_tasks_delete on public.assignment_tasks for delete to authenticated
using(exists(select 1 from public.course_sections cs where cs.id=section_id and public.can_access_school_class(cs.class_id)));
create policy assignment_submissions_read on public.assignment_submissions for select to authenticated
using(exists(select 1 from public.student_accounts sa where sa.student_id=assignment_submissions.student_id and sa.user_id=(select auth.uid())) or
exists(select 1 from public.assignment_tasks t join public.course_sections cs on cs.id=t.section_id where t.id=assignment_submissions.task_id and public.can_access_school_class(cs.class_id)));
create policy assignment_submissions_insert on public.assignment_submissions for insert to authenticated with check
(exists(select 1 from public.assignment_tasks t join public.course_sections cs on cs.id=t.section_id where t.id=assignment_submissions.task_id and
(public.can_access_school_class(cs.class_id) or (cs.is_published and t.is_published and exists(select 1 from public.student_accounts sa where sa.user_id=(select auth.uid()) and sa.student_id=assignment_submissions.student_id and sa.class_id=cs.class_id)))));
create policy assignment_submissions_update on public.assignment_submissions for update to authenticated using
(exists(select 1 from public.assignment_tasks t join public.course_sections cs on cs.id=t.section_id where t.id=assignment_submissions.task_id and
(public.can_access_school_class(cs.class_id) or (cs.is_published and t.is_published and t.allow_resubmit and exists(select 1 from public.student_accounts sa where sa.user_id=(select auth.uid()) and sa.student_id=assignment_submissions.student_id and sa.class_id=cs.class_id)))))
with check(exists(select 1 from public.assignment_tasks t join public.course_sections cs on cs.id=t.section_id where t.id=assignment_submissions.task_id and
(public.can_access_school_class(cs.class_id) or (cs.is_published and t.is_published and t.allow_resubmit and exists(select 1 from public.student_accounts sa where sa.user_id=(select auth.uid()) and sa.student_id=assignment_submissions.student_id and sa.class_id=cs.class_id)))));
create policy assignment_submissions_delete on public.assignment_submissions for delete to authenticated
using(exists(select 1 from public.assignment_tasks t join public.course_sections cs on cs.id=t.section_id where t.id=assignment_submissions.task_id and public.can_access_school_class(cs.class_id)));
create policy assignment_reviews_read on public.assignment_reviews for select to authenticated
using(exists(select 1 from public.assignment_submissions sub where sub.id=assignment_reviews.submission_id));
create policy assignment_reviews_insert on public.assignment_reviews for insert to authenticated
with check(exists(select 1 from public.assignment_submissions sub join public.assignment_tasks t on t.id=sub.task_id join public.course_sections cs on cs.id=t.section_id where sub.id=assignment_reviews.submission_id and public.can_access_school_class(cs.class_id)));
create policy assignment_reviews_update on public.assignment_reviews for update to authenticated
using(exists(select 1 from public.assignment_submissions sub join public.assignment_tasks t on t.id=sub.task_id join public.course_sections cs on cs.id=t.section_id where sub.id=assignment_reviews.submission_id and public.can_access_school_class(cs.class_id)))
with check(exists(select 1 from public.assignment_submissions sub join public.assignment_tasks t on t.id=sub.task_id join public.course_sections cs on cs.id=t.section_id where sub.id=assignment_reviews.submission_id and public.can_access_school_class(cs.class_id)));
create policy assignment_reviews_delete on public.assignment_reviews for delete to authenticated
using(exists(select 1 from public.assignment_submissions sub join public.assignment_tasks t on t.id=sub.task_id join public.course_sections cs on cs.id=t.section_id where sub.id=assignment_reviews.submission_id and public.can_access_school_class(cs.class_id)));
