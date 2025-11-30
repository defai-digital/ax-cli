/**
 * Runtime Invariant Validation
 *
 * This file provides runtime checks for logical invariants that TypeScript
 * cannot verify at compile-time. These catch the "30% logic bugs" that
 * slip through type checking.
 *
 * Philosophy: Fail Fast & Loud
 * - Detect bugs immediately when invariant is violated
 * - Throw descriptive errors with context
 * - Better to crash than silently corrupt data
 */

/**
 * Invariant check - throws if condition is false
 *
 * Use this for conditions that MUST be true for correctness
 */
export function invariant(
  condition: boolean,
  message: string,
  context?: Record<string, any>
): asserts condition {
  if (!condition) {
    const fullMessage = context
      ? `Invariant violation: ${message}\nContext: ${JSON.stringify(context, null, 2)}`
      : `Invariant violation: ${message}`;

    throw new InvariantViolationError(fullMessage);
  }
}

/**
 * Custom error for invariant violations
 */
export class InvariantViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvariantViolationError';
  }
}

/**
 * Assert array is non-empty
 */
export function assertNonEmpty<T>(
  array: T[],
  message: string = 'Array must not be empty'
): asserts array is [T, ...T[]] {
  invariant(array.length > 0, message, { arrayLength: array.length });
}

/**
 * Assert value is defined (not null or undefined)
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message: string = 'Value must be defined'
): asserts value is T {
  invariant(value !== null && value !== undefined, message, { value });
}

/**
 * Assert number is positive
 */
export function assertPositive(
  value: number,
  message: string = 'Number must be positive'
): void {
  invariant(value > 0, message, { value });
}

/**
 * Assert number is non-negative
 */
export function assertNonNegative(
  value: number,
  message: string = 'Number must be non-negative'
): void {
  invariant(value >= 0, message, { value });
}

/**
 * Assert string is non-empty
 */
export function assertNonEmptyString(
  value: string,
  message: string = 'String must not be empty'
): void {
  invariant(value.trim().length > 0, message, { value, length: value.length });
}

/**
 * Assert value is within range
 */
export function assertInRange(
  value: number,
  min: number,
  max: number,
  message?: string
): void {
  const msg = message || `Value must be between ${min} and ${max}`;
  invariant(value >= min && value <= max, msg, { value, min, max });
}

/**
 * Assert map has key
 */
export function assertHasKey<K, V>(
  map: Map<K, V>,
  key: K,
  message?: string
): void {
  const msg = message || `Map must contain key`;
  invariant(map.has(key), msg, { key, mapSize: map.size });
}

/**
 * Assert object has property
 */
export function assertHasProperty<T extends object, K extends string>(
  obj: T,
  key: K,
  message?: string
): asserts obj is T & Record<K, any> {
  const msg = message || `Object must have property "${key}"`;
  invariant(key in obj, msg, { key, objectKeys: Object.keys(obj) });
}

/**
 * MCP-SPECIFIC INVARIANTS
 */

/**
 * Assert connection state is valid
 */
export function assertValidConnectionState(
  state: string,
  validStates: readonly string[]
): void {
  invariant(
    validStates.includes(state),
    `Invalid connection state: "${state}"`,
    { state, validStates }
  );
}

/**
 * Assert server name is valid format
 */
export function assertValidServerName(name: string): void {
  invariant(
    /^[a-z0-9-_]+$/i.test(name),
    `Invalid server name format: "${name}"`,
    { name, pattern: '^[a-z0-9-_]+$' }
  );

  invariant(
    name.length >= 1 && name.length <= 64,
    `Server name length must be between 1 and 64 characters`,
    { name, length: name.length }
  );
}

/**
 * Assert migration result is successful
 */
export function assertMigrationSuccess<T>(
  result: { success: boolean; value?: T; error?: any },
  context?: string
): asserts result is { success: true; value: T } {
  const message = context
    ? `Migration must succeed: ${context}`
    : 'Migration must succeed';

  invariant(
    result.success,
    message,
    { error: result.error }
  );
}

/**
 * Assert no duplicate server names
 */
export function assertNoDuplicates(
  servers: Array<{ name: string }>,
  message: string = 'Server names must be unique'
): void {
  const names = servers.map(s => s.name);
  const unique = new Set(names);

  invariant(
    names.length === unique.size,
    message,
    {
      totalServers: names.length,
      uniqueServers: unique.size,
      duplicates: names.filter((name, index) => names.indexOf(name) !== index)
    }
  );
}

/**
 * Assert mutex is locked
 */
export function assertMutexLocked(
  isLocked: boolean,
  key: string,
  message: string = 'Mutex must be locked before operation'
): void {
  invariant(isLocked, message, { key });
}

/**
 * Assert mutex is unlocked
 */
export function assertMutexUnlocked(
  isLocked: boolean,
  key: string,
  message: string = 'Mutex must be unlocked before operation'
): void {
  invariant(!isLocked, message, { key });
}

/**
 * Assert resource is not disposed
 */
export function assertNotDisposed(
  disposed: boolean,
  resourceName: string,
  message?: string
): void {
  const msg = message || `Resource "${resourceName}" must not be disposed`;
  invariant(!disposed, msg, { resourceName, disposed });
}

/**
 * Assert exactly one of multiple conditions is true
 */
export function assertExactlyOne(
  conditions: boolean[],
  labels: string[],
  message: string = 'Exactly one condition must be true'
): void {
  const trueCount = conditions.filter(Boolean).length;

  invariant(
    trueCount === 1,
    message,
    {
      trueCount,
      conditions: conditions.map((cond, i) => ({ label: labels[i], value: cond }))
    }
  );
}

/**
 * Assert at least one condition is true
 */
export function assertAtLeastOne(
  conditions: boolean[],
  labels: string[],
  message: string = 'At least one condition must be true'
): void {
  const trueCount = conditions.filter(Boolean).length;

  invariant(
    trueCount >= 1,
    message,
    {
      trueCount,
      conditions: conditions.map((cond, i) => ({ label: labels[i], value: cond }))
    }
  );
}

/**
 * Assert config is in expected format
 */
export function assertConfigFormat(
  config: any,
  expectedFormat: 'legacy' | 'modern',
  serverName: string
): void {
  const isLegacy = config.command && !config.transport;
  const isModern = config.transport && config.transport.type;

  if (expectedFormat === 'legacy') {
    invariant(
      isLegacy,
      `Config for "${serverName}" must be in legacy format`,
      { config, serverName }
    );
  } else {
    invariant(
      isModern,
      `Config for "${serverName}" must be in modern format`,
      { config, serverName }
    );
  }
}

/**
 * Assert config has required fields
 */
export function assertConfigHasFields(
  config: any,
  requiredFields: string[],
  serverName: string
): void {
  for (const field of requiredFields) {
    invariant(
      field in config && config[field] !== undefined,
      `Config for "${serverName}" missing required field: ${field}`,
      { config, serverName, missingField: field, requiredFields }
    );
  }
}

/**
 * USAGE PATTERNS
 */

/**
 * Pattern 1: Guard functions
 */
export function guardedConnect(serverName: string, config: any): void {
  // Runtime checks that complement TypeScript
  assertValidServerName(serverName);
  assertDefined(config, `Config for "${serverName}" must be defined`);
  assertConfigHasFields(config, ['name', 'transport'], serverName);

  // Now safe to proceed - invariants verified
  console.log(`Connecting to ${serverName}`);
}

/**
 * Pattern 2: State validation
 */
export function validateConnectionState(
  state: string,
  expectedStates: string[]
): void {
  assertValidConnectionState(state, expectedStates);
}

/**
 * Pattern 3: Pre/Post conditions
 */
export function criticalOperation(value: number): number {
  // Precondition
  assertPositive(value, 'Input must be positive');

  const result = value * 2;

  // Postcondition
  assertPositive(result, 'Result must be positive');
  invariant(result > value, 'Result must be greater than input', { value, result });

  return result;
}

/**
 * Pattern 4: Loop invariants
 */
export function processServers(servers: Array<{ name: string }>): void {
  assertNonEmpty(servers, 'Must have at least one server');

  for (let i = 0; i < servers.length; i++) {
    // Loop invariant: i is in valid range
    assertInRange(i, 0, servers.length - 1, `Index out of bounds`);

    const server: { name: string } = servers[i];
    assertDefined(server, `Server at index ${i} must be defined`);
    assertValidServerName(server.name);

    // Process server...
  }
}

/**
 * Pattern 5: Resource management
 */
export class Resource {
  private disposed = false;

  use(): void {
    assertNotDisposed(this.disposed, 'Resource');
    // Use resource...
  }

  dispose(): void {
    assertNotDisposed(this.disposed, 'Resource');
    this.disposed = true;
  }
}
