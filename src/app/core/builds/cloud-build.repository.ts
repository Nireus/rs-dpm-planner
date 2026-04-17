import { inject, Injectable } from '@angular/core';
import type { PortableConfigDocument } from '../../../simulation-engine/models/portable-config';
import { parsePortableConfigDocument } from '../../../simulation-engine/validation/portable-config';
import { AuthStoreService } from '../auth/auth-store.service';
import { PortableConfigExchangeService } from '../import-export/portable-config-exchange.service';
import { SupabaseClientService } from '../supabase/supabase-client.service';
import { WorkspaceRepositoryService } from '../workspace/workspace-repository.service';
import {
  type BuildMetadataInput,
  type BuildSortOption,
  type BuildStyleTag,
  type BuildVisibility,
  type CloudBuildDetail,
  type CloudBuildOperationResult,
  type CloudBuildSummary,
  type PublicBuildQuery,
} from './build-sharing.models';
import { normalizeBuildStyleTags } from './build-style-tags';

const BUILD_WITH_OWNER_PROFILE_SELECT = '*, profiles!builds_owner_id_fkey(display_name, youtube_url, twitch_url, x_url, discord_url)';

export interface BuildRow {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  config?: unknown;
  schema_version?: number;
  visibility: BuildVisibility;
  style_tags: string[] | null;
  include_profile_socials?: boolean | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  like_count?: number | null;
  voted_by_me?: boolean | null;
  profiles?: {
    display_name?: string | null;
    youtube_url?: string | null;
    twitch_url?: string | null;
    x_url?: string | null;
    discord_url?: string | null;
  } | null;
}

@Injectable({
  providedIn: 'root',
})
export class CloudBuildRepository {
  private readonly supabase = inject(SupabaseClientService);
  private readonly authStore = inject(AuthStoreService);
  private readonly workspaceRepository = inject(WorkspaceRepositoryService);
  private readonly portableConfigExchange = inject(PortableConfigExchangeService);

  async listOwnBuilds(): Promise<CloudBuildOperationResult<CloudBuildSummary[]>> {
    const client = this.requireClient();
    const userId = this.requireUserId();
    if (!client || !userId) {
      return failure('Sign in to view your saved builds.');
    }

    const { data, error } = await client
      .from('builds')
      .select(BUILD_WITH_OWNER_PROFILE_SELECT)
      .eq('owner_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      return failure(error.message);
    }

    return success((data ?? []).map((row) => mapBuildSummary(row as BuildRow)));
  }

  async saveCurrentBuild(
    metadata: BuildMetadataInput,
    visibility: BuildVisibility = 'private',
  ): Promise<CloudBuildOperationResult<CloudBuildSummary>> {
    const client = this.requireClient();
    const userId = this.requireUserId();
    if (!client || !userId) {
      return failure('Sign in to save builds.');
    }

    const config = this.workspaceRepository.readPortableConfigDocument();
    const now = new Date().toISOString();
    const { data, error } = await client
      .from('builds')
      .insert({
        owner_id: userId,
        title: metadata.title.trim(),
        description: metadata.description.trim(),
        config,
        schema_version: config.schemaVersion,
        visibility,
        style_tags: metadata.styleTags,
        include_profile_socials: metadata.includeProfileSocials,
        published_at: visibility === 'public' ? now : null,
      })
      .select(BUILD_WITH_OWNER_PROFILE_SELECT)
      .single();

    if (error) {
      return failure(error.message);
    }

    return success(mapBuildSummary(data as BuildRow));
  }

  async updateBuildFromCurrentWorkspace(
    buildId: string,
    metadata: BuildMetadataInput,
    visibility: BuildVisibility,
  ): Promise<CloudBuildOperationResult<CloudBuildSummary>> {
    const client = this.requireClient();
    const userId = this.requireUserId();
    if (!client || !userId) {
      return failure('Sign in to update builds.');
    }

    const config = this.workspaceRepository.readPortableConfigDocument();
    const now = new Date().toISOString();
    const { data, error } = await client
      .from('builds')
      .update({
        title: metadata.title.trim(),
        description: metadata.description.trim(),
        config,
        schema_version: config.schemaVersion,
        visibility,
        style_tags: metadata.styleTags,
        include_profile_socials: metadata.includeProfileSocials,
        updated_at: now,
        published_at: visibility === 'public' ? now : null,
      })
      .eq('id', buildId)
      .eq('owner_id', userId)
      .select(BUILD_WITH_OWNER_PROFILE_SELECT)
      .single();

    if (error) {
      return failure(error.message);
    }

    return success(mapBuildSummary(data as BuildRow));
  }

  async updateBuildMetadata(
    buildId: string,
    metadata: BuildMetadataInput,
    visibility: BuildVisibility,
  ): Promise<CloudBuildOperationResult<CloudBuildSummary>> {
    const client = this.requireClient();
    const userId = this.requireUserId();
    if (!client || !userId) {
      return failure('Sign in to update builds.');
    }

    const now = new Date().toISOString();
    const { data, error } = await client
      .from('builds')
      .update({
        title: metadata.title.trim(),
        description: metadata.description.trim(),
        visibility,
        style_tags: metadata.styleTags,
        include_profile_socials: metadata.includeProfileSocials,
        updated_at: now,
        published_at: visibility === 'public' ? now : null,
      })
      .eq('id', buildId)
      .eq('owner_id', userId)
      .select(BUILD_WITH_OWNER_PROFILE_SELECT)
      .single();

    if (error) {
      return failure(error.message);
    }

    return success(mapBuildSummary(data as BuildRow));
  }

  async deleteOwnBuild(buildId: string): Promise<CloudBuildOperationResult<true>> {
    const client = this.requireClient();
    const userId = this.requireUserId();
    if (!client || !userId) {
      return failure('Sign in to delete builds.');
    }

    const { error } = await client.from('builds').delete().eq('id', buildId).eq('owner_id', userId);
    return error ? failure(error.message) : success(true);
  }

  async listPublicBuilds(query: PublicBuildQuery): Promise<CloudBuildOperationResult<CloudBuildSummary[]>> {
    const client = this.requireClient();
    if (!client) {
      return failure('Supabase is not configured yet.');
    }

    let request = client
      .from('public_builds_with_stats')
      .select('*');

    const normalizedSearch = query.search.trim();
    if (normalizedSearch) {
      request = request.or(`title.ilike.%${escapeIlike(normalizedSearch)}%,author_name.ilike.%${escapeIlike(normalizedSearch)}%`);
    }

    for (const styleTag of query.styleTags) {
      request = request.contains('style_tags', [styleTag]);
    }

    request = query.sort === 'likes'
      ? request.order('like_count', { ascending: false }).order('published_at', { ascending: false })
      : request.order('published_at', { ascending: false });

    const { data, error } = await request.limit(100);

    if (error) {
      return failure(error.message);
    }

    return success((data ?? []).map((row) => mapPublicSummary(row as Record<string, unknown>)));
  }

  async loadBuildDetail(buildId: string): Promise<CloudBuildOperationResult<CloudBuildDetail>> {
    const client = this.requireClient();
    if (!client) {
      return failure('Supabase is not configured yet.');
    }

    const { data, error } = await client
      .from('builds')
      .select(BUILD_WITH_OWNER_PROFILE_SELECT)
      .eq('id', buildId)
      .single();

    if (error) {
      return failure(error.message);
    }

    const row = data as BuildRow;
    if (row.visibility !== 'public' && row.owner_id !== this.authStore.userId()) {
      return failure('This build is private.');
    }

    const configResult = parsePortableConfigDocument(row.config);
    if (!configResult.success) {
      return failure('Stored build config is no longer valid.');
    }

    return success({
      ...mapBuildSummary(row),
      config: configResult.data,
    });
  }

  async importBuild(buildId: string): Promise<CloudBuildOperationResult<true>> {
    const detail = await this.loadBuildDetail(buildId);
    if (!detail.success) {
      return detail;
    }

    const importResult = this.portableConfigExchange.applyPortableConfigText(JSON.stringify(detail.data.config));
    if (!importResult.success) {
      return failure(importResult.message);
    }

    return success(true);
  }

  async toggleVote(buildId: string): Promise<CloudBuildOperationResult<true>> {
    const client = this.requireClient();
    const userId = this.requireUserId();
    if (!client || !userId) {
      return failure('Sign in to vote for public builds.');
    }

    const { error } = await client.rpc('toggle_build_vote', { target_build_id: buildId });
    return error ? failure(error.message) : success(true);
  }

  private requireClient() {
    return this.supabase.client;
  }

  private requireUserId(): string | null {
    return this.authStore.userId();
  }
}

export function mapBuildSummary(row: BuildRow): CloudBuildSummary {
  return {
    id: row.id,
    ownerId: row.owner_id,
    authorName: row.profiles?.display_name ?? 'Unknown builder',
    title: row.title,
    description: row.description ?? '',
    visibility: row.visibility,
    styleTags: normalizeBuildStyleTags(row.style_tags ?? []),
    includeProfileSocials: row.include_profile_socials ?? false,
    youtubeUrl: row.include_profile_socials ? row.profiles?.youtube_url ?? null : null,
    twitchUrl: row.include_profile_socials ? row.profiles?.twitch_url ?? null : null,
    xUrl: row.include_profile_socials ? row.profiles?.x_url ?? null : null,
    discordUrl: row.include_profile_socials ? row.profiles?.discord_url ?? null : null,
    likeCount: row.like_count ?? 0,
    votedByMe: row.voted_by_me ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  };
}

export function mapPublicSummary(row: Record<string, unknown>): CloudBuildSummary {
  return {
    id: String(row['id']),
    ownerId: String(row['owner_id']),
    authorName: String(row['author_name'] ?? 'Unknown builder'),
    title: String(row['title']),
    description: String(row['description'] ?? ''),
    visibility: 'public',
    styleTags: normalizeBuildStyleTags((row['style_tags'] as string[] | null) ?? []),
    includeProfileSocials: Boolean(row['include_profile_socials']),
    youtubeUrl: nullableString(row['author_youtube_url']),
    twitchUrl: nullableString(row['author_twitch_url']),
    xUrl: nullableString(row['author_x_url']),
    discordUrl: nullableString(row['author_discord_url']),
    likeCount: Number(row['like_count'] ?? 0),
    votedByMe: Boolean(row['voted_by_me']),
    createdAt: String(row['created_at']),
    updatedAt: String(row['updated_at']),
    publishedAt: nullableString(row['published_at']),
  };
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function escapeIlike(value: string): string {
  return value.replaceAll('%', '\\%').replaceAll('_', '\\_').replaceAll(',', '\\,');
}

function success<T>(data: T): CloudBuildOperationResult<T> {
  return { success: true, data };
}

function failure<T>(message: string): CloudBuildOperationResult<T> {
  return { success: false, message };
}
