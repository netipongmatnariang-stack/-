
-- Teacher may see only student-to-Auth mappings for their assigned classroom; students only see their own mapping.
create policy student_accounts_teacher_read on public.student_accounts
 for select to authenticated using (public.can_access_school_class(class_id));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('student-uploads','student-uploads',false,10485760,array[
  'application/pdf','image/png','image/jpeg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
 on conflict(id) do nothing;
create policy "student_files_owner_upload" on storage.objects
 for insert to authenticated with check(
  bucket_id='student-uploads'
  and split_part(name,'/',1)=(select auth.uid())::text
  and exists(select 1 from public.student_accounts sa where sa.user_id=(select auth.uid())));
create policy "student_files_authorized_read" on storage.objects
 for select to authenticated using(
  bucket_id='student-uploads' and (
   split_part(name,'/',1)=(select auth.uid())::text
   or (select public.is_school_admin())
   or exists(select 1 from public.student_accounts sa
             where sa.user_id::text=split_part(name,'/',1)
               and public.can_access_school_class(sa.class_id))
  ));
create policy "student_files_owner_update" on storage.objects
 for update to authenticated using(
  bucket_id='student-uploads' and split_part(name,'/',1)=(select auth.uid())::text)
 with check(bucket_id='student-uploads' and split_part(name,'/',1)=(select auth.uid())::text);
-- Only staff with classroom access may delete an uploaded student file.
create policy "student_files_staff_delete" on storage.objects
 for delete to authenticated using(bucket_id='student-uploads' and (
    (select public.is_school_admin()) or exists(
      select 1 from public.student_accounts sa
      where sa.user_id::text=split_part(name,'/',1)
      and public.can_access_school_class(sa.class_id))
 ));
