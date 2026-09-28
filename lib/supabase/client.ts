// =====================================================================
// PLOTRAS — Supabase browser client
// =====================================================================
// Client-side singleton. Uses the publishable/anon key only — RLS
// (see supabase/schema.sql) governs what an authenticated session can
// actually read. Never import the service-role key here.
// =====================================================================

import { createClient } from "@supabase/supabase-js";

export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
