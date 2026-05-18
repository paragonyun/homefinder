import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const isBrowser = typeof window !== "undefined";

type BrowserClient = ReturnType<typeof createClient>;

let cachedBrowserClient: BrowserClient | null = null;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export function createSupabaseBrowserClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  if (!isBrowser) {
    return createClient(supabaseUrl, supabaseAnonKey);
  }

  cachedBrowserClient ??= createClient(supabaseUrl, supabaseAnonKey);
  return cachedBrowserClient;
}
