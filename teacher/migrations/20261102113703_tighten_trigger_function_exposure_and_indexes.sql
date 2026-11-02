-- Remove unnecessary direct RPC privileges on trigger functions.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.touch_attendance() from public, anon, authenticated;
-- Foreign key maintenance indexes.
create index if not exists attendance_updated_by_idx on public.attendance(updated_by);
create index if not exists worksheets_created_by_idx on public.worksheets(created_by);
