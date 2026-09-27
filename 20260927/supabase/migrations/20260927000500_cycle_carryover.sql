-- XP carried over into a qualification cycle from the previous one (Flying Blue rolls
-- surplus XP over when you reach or requalify for a level). Stored on the cycle so it
-- counts towards that cycle only, never towards calendar-year totals.
alter table public.qualification_cycles
  add column carried_over_xp integer not null default 0 check (carried_over_xp >= 0);
