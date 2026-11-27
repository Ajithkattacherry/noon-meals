-- Repair part 5 of 5: reload the PostgREST schema cache.
-- Paste into Supabase SQL Editor and Run.

notify pgrst, 'reload schema';
