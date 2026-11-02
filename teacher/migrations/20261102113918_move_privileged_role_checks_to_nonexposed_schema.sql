-- Move privileged row-authorization queries out of exposed API schema.
create schema if not exists app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated;

create or replace function app_private.is_school_admin()
returns boolean language sql stable security definer set search_path=''
as $$ select (select auth.uid()) is not null and exists(
 select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'
); $$;

create or replace function app_private.can_access_school_class(class_uuid uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select (select auth.uid()) is not null and (
 app_private.is_school_admin() or exists (
   select 1 from public.class_teachers ct where ct.class_id=class_uuid and ct.teacher_id=(select auth.uid())
 )
); $$;

create or replace function app_private.can_access_student(student_uuid uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select (select auth.uid()) is not null and exists(
 select 1 from public.students st where st.id=student_uuid
 and app_private.can_access_school_class(st.class_id)
); $$;

revoke all on all functions in schema app_private from public,anon;
grant execute on all functions in schema app_private to authenticated;

-- RLS policies already reference these public helper functions.
-- Public wrappers are deliberately invoker-mode, thus no exposed DEFINER RPC.
create or replace function public.is_school_admin()
returns boolean language sql stable security invoker set search_path=''
as $$ select app_private.is_school_admin(); $$;

create or replace function public.can_access_school_class(class_uuid uuid)
returns boolean language sql stable security invoker set search_path=''
as $$ select app_private.can_access_school_class(class_uuid); $$;

create or replace function public.can_access_student(student_uuid uuid)
returns boolean language sql stable security invoker set search_path=''
as $$ select app_private.can_access_student(student_uuid); $$;

revoke all on function public.is_school_admin() from public,anon;
revoke all on function public.can_access_school_class(uuid) from public,anon;
revoke all on function public.can_access_student(uuid) from public,anon;
grant execute on function public.is_school_admin() to authenticated;
grant execute on function public.can_access_school_class(uuid) to authenticated;
grant execute on function public.can_access_student(uuid) to authenticated;
