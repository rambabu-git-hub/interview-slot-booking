-- Run this in Supabase SQL Editor.
-- Tables assumed: interview_slots(id uuid, company text, slot_name text,
-- interview_date date, start_time time, end_time time, created_at timestamptz)
-- and interview_bookings(id uuid, slot_id uuid, candidate_name text, booked_at timestamptz).

alter table public.interview_slots
  add column if not exists notes text;

-- Prevent simultaneous bookings for overlapping time windows on the same date,
-- regardless of company. Existing conflicting bookings must be cleaned up first.
create or replace function public.prevent_overlapping_interview_bookings()
returns trigger language plpgsql as $$
declare d date; st time; en time;
begin
  select interview_date, start_time, end_time into d, st, en
  from public.interview_slots where id = new.slot_id;
  if d is null then raise exception 'Interview slot not found'; end if;
  perform pg_advisory_xact_lock(hashtext(d::text));
  if exists (
    select 1 from public.interview_bookings b
    join public.interview_slots s on s.id=b.slot_id
    where s.interview_date=d
      and s.start_time < en and s.end_time > st
      and b.id is distinct from new.id
  ) then
    raise exception 'OVERLAP: This time is already booked. Please choose another time.';
  end if;
  return new;
end; $$;

drop trigger if exists check_interview_overlap on public.interview_bookings;
create trigger check_interview_overlap
before insert or update of slot_id on public.interview_bookings
for each row execute function public.prevent_overlapping_interview_bookings();

-- Cleanup RPC. Only allow this function to be called by service_role by default.
-- Do NOT expose service_role key in the browser. For admin use, add proper auth/RLS
-- and restrict execution to an authenticated admin before enabling a UI button.
create or replace function public.delete_previous_interview_weeks(cutoff_date date)
returns void language plpgsql security definer set search_path=public as $$
begin
  delete from public.interview_bookings b
  using public.interview_slots s
  where b.slot_id=s.id and s.interview_date < cutoff_date;
  delete from public.interview_slots where interview_date < cutoff_date;
end; $$;
revoke all on function public.delete_previous_interview_weeks(date) from public, anon, authenticated;
grant execute on function public.delete_previous_interview_weeks(date) to service_role;

-- Ensure the app's tables are readable and bookable only under your intended RLS setup.
-- Configure policies in Supabase. Do not leave unrestricted public UPDATE/DELETE policies.
