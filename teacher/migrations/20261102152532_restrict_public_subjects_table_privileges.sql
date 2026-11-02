
revoke insert, update, delete, truncate, references, trigger on public.teacher_subjects from anon;
revoke all privileges on public.teacher_subjects from public;
grant select on public.teacher_subjects to anon, authenticated;
grant insert, update, delete on public.teacher_subjects to authenticated;
