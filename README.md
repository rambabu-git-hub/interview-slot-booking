# Interview Slot Booking — React + Supabase

## A. Create the database
In Supabase → SQL Editor → New query, run:

```sql
create table public.interview_slots (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  slot_name text not null,
  interview_date date not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  constraint valid_time check (end_time > start_time)
);

create table public.interview_bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null unique references public.interview_slots(id) on delete cascade,
  candidate_name text not null,
  booked_at timestamptz not null default now()
);

-- Avoid overlapping slots for the same company on the same date.
create extension if not exists btree_gist;
alter table public.interview_slots
  add constraint no_overlapping_slots
  exclude using gist (
    company with =,
    interview_date with =,
    tsrange(interview_date + start_time, interview_date + end_time, '[)') with &&
  );

-- Demo policies: anyone can read slots; anyone can add/edit slots.
-- Before real use, protect admin writes with Supabase Auth and stricter policies.
alter table public.interview_slots enable row level security;
alter table public.interview_bookings enable row level security;
create policy "public can view slots" on public.interview_slots for select using (true);
create policy "public can add slots" on public.interview_slots for insert with check (true);
create policy "public can edit slots" on public.interview_slots for update using (true) with check (true);
create policy "public can view bookings" on public.interview_bookings for select using (true);

-- Atomic first-come-first-served booking: UNIQUE(slot_id) allows only one winner.
create or replace function public.book_interview_slot(p_slot_id uuid, p_candidate_name text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if nullif(trim(p_candidate_name), '') is null then
    raise exception 'Please enter your name';
  end if;
  insert into public.interview_bookings(slot_id, candidate_name)
  values (p_slot_id, trim(p_candidate_name));
exception
  when unique_violation then
    raise exception 'SLOT_TAKEN: This slot has already been booked';
end;
$$;
grant execute on function public.book_interview_slot(uuid,text) to anon, authenticated;
```

Note: The SQL above is a simple prototype. For real public use, secure admin insert/update behind authentication and consider limiting public access to candidate booking data (e.g. expose only a safe view/status, not candidate names).

## B. Configure the app
1. Install Node.js (LTS) from https://nodejs.org/.
2. Extract the ZIP and open the folder in VS Code.
3. Open a terminal in the project folder and run `npm install`.
4. In Supabase project → Project Settings → API, copy Project URL and anon/public key.
5. A configured `.env.local` is included for your Supabase project. If you need to recreate it, make a file named `.env.local` in the project root:

```
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Use the anon/public key only; never put the service_role key in frontend code.
6. Run `npm run dev` and open the local URL Vite prints.

## C. Deploy free to Vercel
1. Push the project to a GitHub repository. The `.gitignore` excludes `.env.local`; do not commit environment files.
2. Go to https://vercel.com/new and import the repository.
3. Framework preset: Vite. Build command `npm run build`; output directory `dist`.
4. In Vercel Project → Settings → Environment Variables, add both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. Redeploy. Use the free `*.vercel.app` URL.

## Important
The database's unique constraint on `interview_bookings.slot_id` is the actual one-booking-per-slot guarantee. The browser's UI is not the authority; the database decides which concurrent booking succeeds.


## Your Supabase connection
This package's `.env.local` is prefilled with the Project URL and publishable key you provided. Publishable keys are designed for client use; never use a `service_role` or secret key in this app.
