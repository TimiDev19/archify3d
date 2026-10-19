import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseConfig } from './config';
export async function createClient() {
  const jar = await cookies();
  const { url, key } = getSupabaseConfig();
  if (!url || !key) throw new Error('Supabase is not configured. Add the project URL and publishable key to .env.local.');
  return createServerClient(url, key, { cookies: { get(name: string) { return jar.get(name)?.value; }, set(name: string, value: string, options: any) { jar.set({ name, value, ...options }); }, remove(name: string, options: any) { jar.set({ name, value: '', ...options }); } } });
}
