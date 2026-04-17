import { describe, expect, it } from 'vitest';
import { mapBuildSummary, mapPublicSummary, type BuildRow } from './cloud-build.repository';

describe('cloud build repository mappers', () => {
  it('maps owned build rows to cloud build summaries', () => {
    const summary = mapBuildSummary({
      id: 'build-1',
      owner_id: 'user-1',
      title: 'Private ranged build',
      description: 'practice setup',
      visibility: 'private',
      style_tags: ['ranged', 'unknown'],
      include_profile_socials: true,
      created_at: '2026-04-16T10:00:00Z',
      updated_at: '2026-04-16T11:00:00Z',
      published_at: null,
      profiles: {
        display_name: 'Sweaty Builder',
        twitch_url: 'https://twitch.example/channel',
      },
    } satisfies BuildRow);

    expect(summary).toMatchObject({
      id: 'build-1',
      ownerId: 'user-1',
      authorName: 'Sweaty Builder',
      title: 'Private ranged build',
      visibility: 'private',
      styleTags: ['ranged'],
      includeProfileSocials: true,
      likeCount: 0,
      votedByMe: false,
    });
  });

  it('maps public build view rows with vote state and normalized style tags', () => {
    const summary = mapPublicSummary({
      id: 'build-2',
      owner_id: 'user-2',
      author_name: 'Public Planner',
      title: 'Hybrid test',
      description: 'magic/ranged switches',
      style_tags: ['hybrid', 'magic', 'magic'],
      include_profile_socials: true,
      author_youtube_url: 'https://youtube.example/watch',
      author_twitch_url: null,
      author_x_url: null,
      author_discord_url: 'https://discord.example/invite',
      created_at: '2026-04-16T10:00:00Z',
      updated_at: '2026-04-16T11:00:00Z',
      published_at: '2026-04-16T12:00:00Z',
      like_count: 42,
      voted_by_me: true,
    });

    expect(summary).toMatchObject({
      id: 'build-2',
      ownerId: 'user-2',
      authorName: 'Public Planner',
      visibility: 'public',
      styleTags: ['magic', 'hybrid'],
      includeProfileSocials: true,
      likeCount: 42,
      votedByMe: true,
      youtubeUrl: 'https://youtube.example/watch',
      discordUrl: 'https://discord.example/invite',
    });
  });

  it('hides profile socials when the build has not opted in', () => {
    const summary = mapBuildSummary({
      id: 'build-3',
      owner_id: 'user-3',
      title: 'Quiet build',
      description: null,
      visibility: 'public',
      style_tags: ['ranged'],
      include_profile_socials: false,
      created_at: '2026-04-16T10:00:00Z',
      updated_at: '2026-04-16T11:00:00Z',
      published_at: '2026-04-16T12:00:00Z',
      profiles: {
        display_name: 'Private Socials',
        youtube_url: 'https://youtube.example/private',
      },
    } satisfies BuildRow);

    expect(summary.youtubeUrl).toBeNull();
  });
});
