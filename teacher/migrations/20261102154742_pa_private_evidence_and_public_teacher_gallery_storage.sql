
alter table public.pa_evidence add column if not exists file_path text not null default '';
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('teacher-gallery','teacher-gallery',true,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do nothing;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('teacher-pa-files','teacher-pa-files',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict(id) do nothing;
create policy teacher_gallery_admin_insert on storage.objects
 for insert to authenticated with check(bucket_id='teacher-gallery' and (select public.is_school_admin()));
create policy teacher_gallery_admin_update on storage.objects
 for update to authenticated using(bucket_id='teacher-gallery' and (select public.is_school_admin()))
 with check(bucket_id='teacher-gallery' and (select public.is_school_admin()));
create policy teacher_gallery_admin_delete on storage.objects
 for delete to authenticated using(bucket_id='teacher-gallery' and (select public.is_school_admin()));
create policy teacher_pa_admin_select on storage.objects
 for select to authenticated using(bucket_id='teacher-pa-files' and (select public.is_school_admin()));
create policy teacher_pa_admin_insert on storage.objects
 for insert to authenticated with check(bucket_id='teacher-pa-files' and (select public.is_school_admin()));
create policy teacher_pa_admin_update on storage.objects
 for update to authenticated using(bucket_id='teacher-pa-files' and (select public.is_school_admin()))
 with check(bucket_id='teacher-pa-files' and (select public.is_school_admin()));
create policy teacher_pa_admin_delete on storage.objects
 for delete to authenticated using(bucket_id='teacher-pa-files' and (select public.is_school_admin()));
