import { Injectable } from '@angular/core';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class SupabaseClientService {
  readonly client: SupabaseClient | null = createConfiguredSupabaseClient();

  get isConfigured(): boolean {
    return this.client !== null;
  }
}

function createConfiguredSupabaseClient(): SupabaseClient | null {
  const { url, anonKey } = environment.supabase;

  if (!isSupabaseValueConfigured(url) || !isSupabaseValueConfigured(anonKey)) {
    return null;
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

function isSupabaseValueConfigured(value: string): boolean {
  return Boolean(value?.trim()) && !value.includes('YOUR_');
}
