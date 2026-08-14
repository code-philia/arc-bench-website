import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_HACKATHON_SUPABASE_URL?.trim();
const supabasePublishableKey = import.meta.env.VITE_HACKATHON_SUPABASE_ANON_KEY?.trim();

let client: SupabaseClient | null | undefined;

export function getHackathonSupabaseClient(): SupabaseClient | null {
  if (client !== undefined) {
    return client;
  }
  if (!supabaseUrl || !supabasePublishableKey) {
    client = null;
    return client;
  }

  client = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  return client;
}
