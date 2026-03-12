import { createClient } from "@supabase/supabase-js";

function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL env var is required");
  return url;
}

function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY env var is required");
  return key;
}

function getSupabaseServiceKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY env var is required");
  return key;
}

/** Client-side Supabase client (uses anon key, respects RLS) */
export function createBrowserClient() {
  return createClient(getSupabaseUrl(), getSupabaseAnonKey());
}

/** Server-side Supabase client (uses service role key, bypasses RLS) */
export function createServerClient() {
  return createClient(getSupabaseUrl(), getSupabaseServiceKey());
}
