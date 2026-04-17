import { describe, expect, it } from 'vitest';
import {
  CREATE_PUBLIC_BUILD_LIMIT_MESSAGE,
  getCreateBuildLimitMessage,
  getPublishBuildLimitMessage,
  PUBLISH_BUILD_LIMIT_MESSAGE,
  SAVED_BUILD_LIMIT_MESSAGE,
} from './build-limits';

describe('build limits', () => {
  it('allows private saves below the saved build limit', () => {
    expect(getCreateBuildLimitMessage(49, 20, 'private')).toBeNull();
  });

  it('blocks new saves at the saved build limit', () => {
    expect(getCreateBuildLimitMessage(50, 0, 'private')).toBe(SAVED_BUILD_LIMIT_MESSAGE);
  });

  it('blocks new public saves at the public build limit', () => {
    expect(getCreateBuildLimitMessage(49, 20, 'public')).toBe(CREATE_PUBLIC_BUILD_LIMIT_MESSAGE);
  });

  it('blocks publishing when twenty other builds are already public', () => {
    expect(getPublishBuildLimitMessage(20)).toBe(PUBLISH_BUILD_LIMIT_MESSAGE);
  });

  it('allows updating an existing public build when only nineteen other builds are public', () => {
    expect(getPublishBuildLimitMessage(19)).toBeNull();
  });
});
