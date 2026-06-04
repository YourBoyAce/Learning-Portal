alter table public.user_video_progress
add column if not exists last_position_seconds integer not null default 0;

create index if not exists idx_user_video_progress_resume_lookup
on public.user_video_progress (user_id, course_id, video_id, updated_at desc);
