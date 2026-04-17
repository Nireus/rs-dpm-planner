import type { PortableConfigDocument } from '../../../simulation-engine/models/portable-config';

export type BuildVisibility = 'private' | 'public';
export type BuildSortOption = 'likes' | 'newest';
export type BuildStyleTag = 'ranged' | 'melee' | 'magic' | 'necromancy' | 'hybrid';

export interface BuildSocialLinks {
  youtubeUrl?: string | null;
  twitchUrl?: string | null;
  xUrl?: string | null;
  discordUrl?: string | null;
}

export interface BuildMetadataInput {
  title: string;
  description: string;
  styleTags: BuildStyleTag[];
  includeProfileSocials: boolean;
}

export interface CloudBuildSummary extends BuildSocialLinks {
  id: string;
  ownerId: string;
  authorName: string;
  title: string;
  description: string;
  visibility: BuildVisibility;
  styleTags: BuildStyleTag[];
  includeProfileSocials: boolean;
  likeCount: number;
  votedByMe: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface CloudBuildDetail extends CloudBuildSummary {
  config: PortableConfigDocument;
}

export interface PublicBuildQuery {
  search: string;
  styleTags: BuildStyleTag[];
  sort: BuildSortOption;
}

export type CloudBuildOperationResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      message: string;
    };

export const BUILD_STYLE_OPTIONS: readonly { id: BuildStyleTag; label: string; iconPath?: string }[] = [
  { id: 'ranged', label: 'Ranged', iconPath: '/icons/wiki/ranged-icon.png' },
  { id: 'melee', label: 'Melee', iconPath: '/icons/wiki/attack-icon.png' },
  { id: 'magic', label: 'Magic', iconPath: '/icons/wiki/magic-icon.png' },
  { id: 'necromancy', label: 'Necromancy', iconPath: '/icons/wiki/necromancy-icon.png' },
  { id: 'hybrid', label: 'Hybrid' },
];
