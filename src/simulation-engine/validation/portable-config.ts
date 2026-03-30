import {
  PORTABLE_CONFIG_SCHEMA_VERSION,
  type PortableConfigDocument,
} from '../models/portable-config';
import { sanitizePlayerStats } from './player-stats';

export type PortableConfigValidationCode =
  | 'invalid-root'
  | 'missing-field'
  | 'invalid-type'
  | 'unsupported-schema-version';

export interface PortableConfigValidationError {
  code: PortableConfigValidationCode;
  path: string;
  message: string;
}

export type PortableConfigParseResult =
  | {
      success: true;
      data: PortableConfigDocument;
    }
  | {
      success: false;
      errors: PortableConfigValidationError[];
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pushError(
  errors: PortableConfigValidationError[],
  code: PortableConfigValidationCode,
  path: string,
  message: string,
): void {
  errors.push({ code, path, message });
}

function requireRecordField(
  parent: Record<string, unknown>,
  fieldName: string,
  errors: PortableConfigValidationError[],
): Record<string, unknown> | undefined {
  const value = parent[fieldName];

  if (value === undefined) {
    pushError(errors, 'missing-field', fieldName, `Missing required field "${fieldName}".`);
    return undefined;
  }

  if (!isRecord(value)) {
    pushError(
      errors,
      'invalid-type',
      fieldName,
      `Expected "${fieldName}" to be an object.`,
    );
    return undefined;
  }

  return value;
}

function requireNumberField(
  parent: Record<string, unknown>,
  fieldName: string,
  path: string,
  errors: PortableConfigValidationError[],
): number | undefined {
  const value = parent[fieldName];

  if (typeof value !== 'number' || Number.isNaN(value)) {
    pushError(errors, 'invalid-type', path, `Expected "${path}" to be a number.`);
    return undefined;
  }

  return value;
}

function requireArrayField(
  parent: Record<string, unknown>,
  fieldName: string,
  path: string,
  errors: PortableConfigValidationError[],
): unknown[] | undefined {
  const value = parent[fieldName];

  if (!Array.isArray(value)) {
    pushError(errors, 'invalid-type', path, `Expected "${path}" to be an array.`);
    return undefined;
  }

  return value;
}

export function parsePortableConfigDocument(input: unknown): PortableConfigParseResult {
  const errors: PortableConfigValidationError[] = [];

  if (!isRecord(input)) {
    return {
      success: false,
      errors: [
        {
          code: 'invalid-root',
          path: '$',
          message: 'Portable config document must be an object.',
        },
      ],
    };
  }

  const schemaVersion = input['schemaVersion'];

  if (typeof schemaVersion !== 'number' || Number.isNaN(schemaVersion)) {
    pushError(errors, 'invalid-type', 'schemaVersion', 'Expected "schemaVersion" to be a number.');
  } else if (schemaVersion !== PORTABLE_CONFIG_SCHEMA_VERSION) {
    pushError(
      errors,
      'unsupported-schema-version',
      'schemaVersion',
      `Unsupported schemaVersion ${schemaVersion}. Expected ${PORTABLE_CONFIG_SCHEMA_VERSION}.`,
    );
  }

  const playerStats = requireRecordField(input, 'playerStats', errors);
  const gearSetup = requireRecordField(input, 'gearSetup', errors);
  const inventory = requireRecordField(input, 'inventory', errors);
  const persistentBuffConfig = requireRecordField(input, 'persistentBuffConfig', errors);
  const rotationPlan = requireRecordField(input, 'rotationPlan', errors);

  if (playerStats) {
    requireNumberField(playerStats, 'rangedLevel', 'playerStats.rangedLevel', errors);
  }

  if (gearSetup && !isRecord(gearSetup['equipment'])) {
    pushError(errors, 'invalid-type', 'gearSetup.equipment', 'Expected "gearSetup.equipment" to be an object.');
  }

  if (inventory) {
    requireArrayField(inventory, 'items', 'inventory.items', errors);
  }

  if (rotationPlan) {
    requireNumberField(
      rotationPlan,
      'startingAdrenaline',
      'rotationPlan.startingAdrenaline',
      errors,
    );
    requireNumberField(rotationPlan, 'tickCount', 'rotationPlan.tickCount', errors);
    requireArrayField(rotationPlan, 'nonGcdActions', 'rotationPlan.nonGcdActions', errors);
    requireArrayField(rotationPlan, 'abilityActions', 'rotationPlan.abilityActions', errors);
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    data: {
      schemaVersion: PORTABLE_CONFIG_SCHEMA_VERSION,
      playerStats: sanitizePlayerStats(
        playerStats as unknown as PortableConfigDocument['playerStats'],
      ),
      gearSetup: gearSetup as unknown as PortableConfigDocument['gearSetup'],
      inventory: inventory as unknown as PortableConfigDocument['inventory'],
      persistentBuffConfig:
        persistentBuffConfig as unknown as PortableConfigDocument['persistentBuffConfig'],
      rotationPlan: rotationPlan as unknown as PortableConfigDocument['rotationPlan'],
    },
  };
}
