import { computed, inject, Injectable, signal } from '@angular/core';
import type { AuthError, Session, User } from '@supabase/supabase-js';
import { containsBlockedLanguage, DISPLAY_NAME_BLOCKED_LANGUAGE_MESSAGE } from '../content-moderation/blocked-language';
import { SupabaseClientService } from '../supabase/supabase-client.service';

export interface UserProfile {
  id: string;
  displayName: string;
  youtubeUrl: string | null;
  twitchUrl: string | null;
  xUrl: string | null;
  discordUrl: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class AuthStoreService {
  private readonly supabase = inject(SupabaseClientService);
  private readonly sessionSignal = signal<Session | null>(null);
  private readonly profileSignal = signal<UserProfile | null>(null);

  readonly initialized = signal(false);
  readonly busy = signal(false);
  readonly message = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly session = this.sessionSignal.asReadonly();
  readonly profile = this.profileSignal.asReadonly();
  readonly isConfigured = computed(() => this.supabase.isConfigured);
  readonly user = computed<User | null>(() => this.sessionSignal()?.user ?? null);
  readonly userId = computed(() => this.user()?.id ?? null);
  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly displayName = computed(() => this.profileSignal()?.displayName ?? this.user()?.email ?? 'Signed in user');

  constructor() {
    void this.initialize();
  }

  async initialize(): Promise<void> {
    const client = this.supabase.client;
    if (!client) {
      this.initialized.set(true);
      return;
    }

    const { data } = await client.auth.getSession();
    await this.applySession(data.session);

    client.auth.onAuthStateChange((_event, session) => {
      void this.applySession(session);
    });

    this.initialized.set(true);
  }

  async signInWithMagicLink(email: string): Promise<void> {
    const client = this.requireClient();
    if (!client) {
      return;
    }

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      this.error.set('Enter an email address first.');
      return;
    }

    this.busy.set(true);
    this.error.set(null);
    this.message.set(null);

    const { error } = await client.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    this.busy.set(false);
    this.handleAuthResult(error, 'Magic link sent. Check your email to finish signing in.');
  }

  async signOut(): Promise<void> {
    const client = this.requireClient();
    if (!client) {
      return;
    }

    this.busy.set(true);
    const { error } = await client.auth.signOut();
    this.busy.set(false);
    this.handleAuthResult(error, 'Signed out.');
  }

  async saveProfile(input: {
    displayName: string;
    youtubeUrl: string;
    twitchUrl: string;
    xUrl: string;
    discordUrl: string;
  }): Promise<void> {
    const client = this.requireClient();
    const userId = this.userId();
    if (!client || !userId) {
      this.error.set('Sign in before updating your profile.');
      return;
    }

    const trimmed = input.displayName.trim();
    if (trimmed.length < 2) {
      this.error.set('Display name must be at least 2 characters.');
      return;
    }
    if (containsBlockedLanguage(trimmed)) {
      this.error.set(DISPLAY_NAME_BLOCKED_LANGUAGE_MESSAGE);
      return;
    }

    this.busy.set(true);
    this.error.set(null);
    const { error } = await client
      .from('profiles')
      .upsert({
        id: userId,
        display_name: trimmed,
        youtube_url: normalizeOptionalUrl(input.youtubeUrl),
        twitch_url: normalizeOptionalUrl(input.twitchUrl),
        x_url: normalizeOptionalUrl(input.xUrl),
        discord_url: normalizeOptionalUrl(input.discordUrl),
        updated_at: new Date().toISOString(),
      });
    this.busy.set(false);

    if (error) {
      this.error.set(error.message);
      return;
    }

    this.profileSignal.set({
      id: userId,
      displayName: trimmed,
      youtubeUrl: normalizeOptionalUrl(input.youtubeUrl),
      twitchUrl: normalizeOptionalUrl(input.twitchUrl),
      xUrl: normalizeOptionalUrl(input.xUrl),
      discordUrl: normalizeOptionalUrl(input.discordUrl),
    });
    this.message.set('Profile saved.');
  }

  async refreshProfile(): Promise<void> {
    const user = this.user();
    if (!user) {
      this.profileSignal.set(null);
      return;
    }

    await this.ensureProfile(user);
  }

  private async applySession(session: Session | null): Promise<void> {
    this.sessionSignal.set(session);

    if (!session?.user) {
      this.profileSignal.set(null);
      return;
    }

    await this.ensureProfile(session.user);
  }

  private async ensureProfile(user: User): Promise<void> {
    const client = this.supabase.client;
    if (!client) {
      return;
    }

    const { data, error } = await client
      .from('profiles')
      .select('id, display_name, youtube_url, twitch_url, x_url, discord_url')
      .eq('id', user.id)
      .maybeSingle();

    if (data && !error) {
      this.profileSignal.set(mapProfileRow(data));
      return;
    }

    const fallbackDisplayName = deriveDisplayName(user);
    const { data: upsertedProfile } = await client
      .from('profiles')
      .upsert({ id: user.id, display_name: fallbackDisplayName, updated_at: new Date().toISOString() })
      .select('id, display_name, youtube_url, twitch_url, x_url, discord_url')
      .single();

    this.profileSignal.set(
      upsertedProfile
        ? mapProfileRow(upsertedProfile)
        : {
            id: user.id,
            displayName: fallbackDisplayName,
            youtubeUrl: null,
            twitchUrl: null,
            xUrl: null,
            discordUrl: null,
          },
    );
  }

  private requireClient(): NonNullable<SupabaseClientService['client']> | null {
    const client = this.supabase.client;
    if (!client) {
      this.error.set('Supabase is not configured yet. Add your dev/prod URL and anon key first.');
      return null;
    }

    return client;
  }

  private handleAuthResult(error: AuthError | null, successMessage: string | null): void {
    if (error) {
      this.error.set(error.message);
      return;
    }

    if (successMessage) {
      this.message.set(successMessage);
    }
  }
}

function mapProfileRow(row: {
  id: string;
  display_name: string;
  youtube_url?: string | null;
  twitch_url?: string | null;
  x_url?: string | null;
  discord_url?: string | null;
}): UserProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    youtubeUrl: row.youtube_url ?? null,
    twitchUrl: row.twitch_url ?? null,
    xUrl: row.x_url ?? null,
    discordUrl: row.discord_url ?? null,
  };
}

function normalizeOptionalUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function deriveDisplayName(user: User): string {
  const metadataName = typeof user.user_metadata?.['name'] === 'string' ? user.user_metadata['name'] : null;
  if (metadataName?.trim()) {
    const trimmedName = metadataName.trim();
    return containsBlockedLanguage(trimmedName) ? 'RuneScape Planner' : trimmedName;
  }

  const emailName = user.email?.split('@')[0]?.trim();
  return emailName && !containsBlockedLanguage(emailName) ? emailName : 'RuneScape Planner';
}
