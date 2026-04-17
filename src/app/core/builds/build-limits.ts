import type { BuildVisibility } from './build-sharing.models';

export const MAX_SAVED_BUILDS_PER_USER = 50;
export const MAX_PUBLIC_BUILDS_PER_USER = 20;

export const SAVED_BUILD_LIMIT_MESSAGE =
  `You can save up to ${MAX_SAVED_BUILDS_PER_USER} builds. Delete an older build before saving another.`;

export const CREATE_PUBLIC_BUILD_LIMIT_MESSAGE =
  `You can publish up to ${MAX_PUBLIC_BUILDS_PER_USER} builds. Save this build as private or unpublish another build first.`;

export const PUBLISH_BUILD_LIMIT_MESSAGE =
  `You can publish up to ${MAX_PUBLIC_BUILDS_PER_USER} builds. Unpublish another build before publishing this one.`;

export function getCreateBuildLimitMessage(
  savedBuildCount: number,
  publicBuildCount: number,
  visibility: BuildVisibility,
): string | null {
  if (savedBuildCount >= MAX_SAVED_BUILDS_PER_USER) {
    return SAVED_BUILD_LIMIT_MESSAGE;
  }

  if (visibility === 'public' && publicBuildCount >= MAX_PUBLIC_BUILDS_PER_USER) {
    return CREATE_PUBLIC_BUILD_LIMIT_MESSAGE;
  }

  return null;
}

export function getPublishBuildLimitMessage(publicBuildCountExcludingBuild: number): string | null {
  return publicBuildCountExcludingBuild >= MAX_PUBLIC_BUILDS_PER_USER
    ? PUBLISH_BUILD_LIMIT_MESSAGE
    : null;
}
