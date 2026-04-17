import { diagnoseConfig, type Diagnostic } from '@any_table/spec';

export const VALIDATE_SPEC_TOOL = {
  name: 'any_table_validate_spec',
  title: 'Validate an AnyTable TableSpec',
  description:
    'Run schema and semantic validation on a candidate TableSpec. Returns errors (hard failures that will prevent rendering) and warnings (likely problems that will still render).',
} as const;

export interface ValidateSpecResult {
  valid: boolean;
  errors: Diagnostic[];
  warnings: Diagnostic[];
}

export function handleValidateSpec(input: { spec: unknown }): ValidateSpecResult {
  const { errors, warnings } = diagnoseConfig(input.spec);
  return { valid: errors.length === 0, errors, warnings };
}
