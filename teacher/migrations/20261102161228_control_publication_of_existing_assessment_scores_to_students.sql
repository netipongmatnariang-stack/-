
alter table public.assessments add column if not exists is_published boolean not null default false;
drop policy if exists student_assessments_read on public.assessments;
create policy student_assessments_read on public.assessments for select to authenticated
using(is_published and exists(select 1 from public.student_accounts sa
 where sa.class_id=assessments.class_id and sa.user_id=(select auth.uid())));
drop policy if exists student_scores_read on public.assessment_scores;
create policy student_scores_read on public.assessment_scores for select to authenticated
using(exists(select 1 from public.assessments a join public.student_accounts sa
 on sa.class_id=a.class_id where a.id=assessment_scores.assessment_id
 and a.is_published and sa.student_id=assessment_scores.student_id
 and sa.user_id=(select auth.uid())));
