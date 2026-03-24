import type { EntityId } from '../types';

export interface NormalizationIssue {
  code: 'duplicate-id';
  id: EntityId;
  message: string;
}

export interface NormalizationResult<T extends { id: EntityId }> {
  records: Record<EntityId, T>;
  issues: NormalizationIssue[];
}

export function normalizeById<T extends { id: EntityId }>(
  definitions: readonly T[],
): NormalizationResult<T> {
  const records: Record<EntityId, T> = {};
  const issues: NormalizationIssue[] = [];

  for (const definition of definitions) {
    if (records[definition.id]) {
      issues.push({
        code: 'duplicate-id',
        id: definition.id,
        message: `Duplicate definition id "${definition.id}" encountered during normalization.`,
      });
      continue;
    }

    records[definition.id] = definition;
  }

  return {
    records,
    issues,
  };
}
