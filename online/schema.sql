-- โรงเรียนบ้านหินลาด | ฐานข้อมูลกลางสำหรับระบบเช็คชื่อนักเรียน
-- ใช้กับ Supabase SQL Editor หลังสร้างโปรเจ็กต์ของโรงเรียน
-- ปลอดภัย: ข้อมูลมี RLS, ไม่ใช้ service_role key ในเว็บไซต์

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'teacher'
    check (role in ('admin', 'teacher')),
  created_at timestamptz not null default now()
);

create table if not exists public.school_classes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 1 and 100),
  created_at timestamptz not null default now()
);

create table if not exists public.class_teachers (
  class_id uuid not null references public.school_classes(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (class_id, teacher_id)
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.school_classes(id) on delete restrict,
  student_no integer not null check (student_no between 1 and 999),
  full_name text not null check (length(trim(full_name)) between 1 and 200),
  created_at timestamptz not null default now(),
  unique (class_id, student_no)
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  attendance_date date not null,
  status text not null check (status in ('present','absent','late','sick','personal')),
  note text not null default '' check (length(note) <= 1000),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (student_id, attendance_date)
);

create index if not exists attendance_date_idx on public.attendance(attendance_date);
create index if not exists attendance_student_idx on public.attendance(student_id);
create index if not exists students_class_idx on public.students(class_id);
create index if not exists class_teachers_teacher_idx on public.class_teachers(teacher_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles(id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name',''), 'teacher')
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created_school on auth.users;
create trigger on_auth_user_created_school
after insert on auth.users for each row
execute function public.handle_new_user();

-- เติม profile ให้ผู้ใช้ที่สร้างก่อนติดตั้งสคีมา (ไม่ยกระดับสิทธิ์)
insert into public.profiles (id, full_name, role)
select id, coalesce(raw_user_meta_data ->> 'full_name',''), 'teacher'
from auth.users
on conflict (id) do nothing;

create or replace function public.is_school_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

create or replace function public.can_access_school_class(class_uuid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_school_admin() or exists (
    select 1 from public.class_teachers ct
    where ct.class_id = class_uuid and ct.teacher_id = (select auth.uid())
  );
$$;

create or replace function public.can_access_student(student_uuid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.students s
    where s.id = student_uuid
      and public.can_access_school_class(s.class_id)
  );
$$;

create or replace function public.touch_attendance()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end; $$;

drop trigger if exists attendance_touch on public.attendance;
create trigger attendance_touch before insert or update on public.attendance
for each row execute function public.touch_attendance();

alter table public.profiles enable row level security;
alter table public.school_classes enable row level security;
alter table public.class_teachers enable row level security;
alter table public.students enable row level security;
alter table public.attendance enable row level security;

-- ไม่เปิดสิทธิ์ anon ให้ตารางใดเลย
revoke all on public.profiles, public.school_classes, public.class_teachers,
  public.students, public.attendance from anon;
grant select, insert, update, delete on public.profiles, public.school_classes,
  public.class_teachers, public.students, public.attendance to authenticated;
revoke all on function public.handle_new_user() from public;
revoke all on function public.touch_attendance() from public;
grant execute on function public.is_school_admin() to authenticated;
grant execute on function public.can_access_school_class(uuid) to authenticated;
grant execute on function public.can_access_student(uuid) to authenticated;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.is_school_admin()));
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles for update to authenticated
using ((select public.is_school_admin()))
with check ((select public.is_school_admin()));

drop policy if exists classes_read on public.school_classes;
create policy classes_read on public.school_classes for select to authenticated
using (public.can_access_school_class(id));
drop policy if exists classes_insert on public.school_classes;
create policy classes_insert on public.school_classes for insert to authenticated
with check ((select public.is_school_admin()));
drop policy if exists classes_update on public.school_classes;
create policy classes_update on public.school_classes for update to authenticated
using ((select public.is_school_admin())) with check ((select public.is_school_admin()));
drop policy if exists classes_delete on public.school_classes;
create policy classes_delete on public.school_classes for delete to authenticated
using ((select public.is_school_admin()));

drop policy if exists assignments_read on public.class_teachers;
create policy assignments_read on public.class_teachers for select to authenticated
using (teacher_id = (select auth.uid()) or (select public.is_school_admin()));
drop policy if exists assignments_insert on public.class_teachers;
create policy assignments_insert on public.class_teachers for insert to authenticated
with check ((select public.is_school_admin()));
drop policy if exists assignments_delete on public.class_teachers;
create policy assignments_delete on public.class_teachers for delete to authenticated
using ((select public.is_school_admin()));

drop policy if exists students_read on public.students;
create policy students_read on public.students for select to authenticated
using (public.can_access_school_class(class_id));
drop policy if exists students_insert on public.students;
create policy students_insert on public.students for insert to authenticated
with check (public.can_access_school_class(class_id));
drop policy if exists students_update on public.students;
create policy students_update on public.students for update to authenticated
using (public.can_access_school_class(class_id))
with check (public.can_access_school_class(class_id));
drop policy if exists students_delete on public.students;
create policy students_delete on public.students for delete to authenticated
using (public.can_access_school_class(class_id));

drop policy if exists attendance_read on public.attendance;
create policy attendance_read on public.attendance for select to authenticated
using (public.can_access_student(student_id));
drop policy if exists attendance_insert on public.attendance;
create policy attendance_insert on public.attendance for insert to authenticated
with check (public.can_access_student(student_id));
drop policy if exists attendance_update on public.attendance;
create policy attendance_update on public.attendance for update to authenticated
using (public.can_access_student(student_id))
with check (public.can_access_student(student_id));
drop policy if exists attendance_delete on public.attendance;
create policy attendance_delete on public.attendance for delete to authenticated
using (public.can_access_student(student_id));

-- เมื่อติดตั้งเสร็จ: สร้างบัญชีของผู้ดูแลใน Authentication > Users ก่อน
-- แล้วรันคำสั่งต่อไปนี้ (แก้อีเมลให้ตรงบัญชีที่ยืนยันแล้ว):
-- update public.profiles p set role = 'admin', full_name = 'ผู้ดูแลระบบ'
-- from auth.users u where u.id = p.id and u.email = 'ADMIN_EMAIL_HERE';
