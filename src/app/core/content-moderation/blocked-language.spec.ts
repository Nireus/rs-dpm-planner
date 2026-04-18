import { describe, expect, it } from 'vitest';
import {
  containsBlockedLanguage,
  getBlockedLanguageMessage,
  PUBLIC_BUILD_NAME_BLOCKED_LANGUAGE_MESSAGE,
} from './blocked-language';

describe('blocked language moderation', () => {
  it('allows normal RuneScape names and public build titles', () => {
    expect(containsBlockedLanguage('Sweaty Raksha planner')).toBe(false);
    expect(containsBlockedLanguage('Wen arrow Rapid Fire practice')).toBe(false);
    expect(containsBlockedLanguage('Cockatrice practice')).toBe(false);
  });

  it('blocks direct blocked terms as standalone words', () => {
    expect(containsBlockedLanguage('shit rotation')).toBe(true);
  });

  it('blocks separator and leetspeak obfuscation', () => {
    expect(containsBlockedLanguage('f.u.c.k')).toBe(true);
    expect(containsBlockedLanguage('f.u.c.k build')).toBe(true);
    expect(containsBlockedLanguage('x f u c k x')).toBe(true);
    expect(containsBlockedLanguage('5h1t')).toBe(true);
  });

  it('returns the caller-provided user-facing message', () => {
    expect(getBlockedLanguageMessage('shit build', PUBLIC_BUILD_NAME_BLOCKED_LANGUAGE_MESSAGE)).toBe(
      PUBLIC_BUILD_NAME_BLOCKED_LANGUAGE_MESSAGE,
    );
  });
});
