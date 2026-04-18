export const DISPLAY_NAME_BLOCKED_LANGUAGE_MESSAGE = 'Display name contains language that is not allowed.';
export const PUBLIC_BUILD_NAME_BLOCKED_LANGUAGE_MESSAGE = 'Build name contains language that is not allowed.';

const BLOCKED_TERM_LIST = [
  'arsehole',
  'asshole',
  'bastard',
  'bitch',
  'bollocks',
  'bullshit',
  'cock',
  'cocksucker',
  'cunt',
  'dick',
  'dickhead',
  'fuck',
  'fucker',
  'fucking',
  'motherfucker',
  'piss',
  'prick',
  'shit',
  'shitty',
  'slut',
  'twat',
  'wanker',
] as const;

const BLOCKED_TERMS = new Set<string>(BLOCKED_TERM_LIST);

const LEET_REPLACEMENTS: Partial<Record<string, string>> = {
  '0': 'o',
  '1': 'i',
  '!': 'i',
  '3': 'e',
  '4': 'a',
  '@': 'a',
  '5': 's',
  '$': 's',
  '7': 't',
};

export function containsBlockedLanguage(value: string): boolean {
  const normalizedWords = normalizeModeratedText(value);
  if (normalizedWords.some((word) => BLOCKED_TERMS.has(word))) {
    return true;
  }
  if (singleLetterRuns(normalizedWords).some((word) => containsBlockedTerm(word))) {
    return true;
  }

  const compact = normalizedWords.join('');
  return compact.length > 0 && BLOCKED_TERMS.has(compact);
}

export function getBlockedLanguageMessage(value: string, message: string): string | null {
  return containsBlockedLanguage(value) ? message : null;
}

function normalizeModeratedText(value: string): string[] {
  return [...value.toLowerCase()]
    .map((character) => LEET_REPLACEMENTS[character] ?? character)
    .join('')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function singleLetterRuns(words: string[]): string[] {
  const runs: string[] = [];
  let currentRun = '';

  for (const word of words) {
    if (word.length === 1) {
      currentRun += word;
      continue;
    }

    if (currentRun) {
      runs.push(currentRun);
      currentRun = '';
    }
  }

  if (currentRun) {
    runs.push(currentRun);
  }

  return runs;
}

function containsBlockedTerm(value: string): boolean {
  return BLOCKED_TERM_LIST.some((term) => value.includes(term));
}
