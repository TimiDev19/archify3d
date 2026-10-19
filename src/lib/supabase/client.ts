import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseConfig } from './config';
export function createClient() {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) throw new Error('Supabase is not configured. Add the project URL and publishable key to .env.local.');
  return createBrowserClient(url, key);
}
