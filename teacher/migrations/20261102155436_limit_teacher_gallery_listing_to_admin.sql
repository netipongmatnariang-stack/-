
drop policy if exists teacher_gallery_public_select on storage.objects;
create policy teacher_gallery_admin_select on storage.objects
 for select to authenticated using(bucket_id='teacher-gallery' and (select public.is_school_admin()));
