/**
 * Minimal RFC 6901 JSON Pointer helpers used for A2UI data binding.
 * `setPointer` returns a *new* object graph (immutably) so that Angular
 * signals detect the change and re-render bound components.
 */

function unescape(token: string): string {
  return token.replace(/~1/g, '/').replace(/~0/g, '~');
}

function parse(pointer: string): string[] {
  if (!pointer || pointer === '/') return [];
  return pointer.replace(/^\//, '').split('/').map(unescape);
}

export function getPointer(root: unknown, pointer: string): unknown {
  const parts = parse(pointer);
  let current: unknown = root;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function setPointer(
  root: Record<string, unknown>,
  pointer: string,
  value: unknown,
): Record<string, unknown> {
  const parts = parse(pointer);
  if (parts.length === 0) {
    return (value ?? {}) as Record<string, unknown>;
  }
  const next = { ...(root ?? {}) };
  let cursor: Record<string, unknown> = next;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const child = cursor[key];
    cursor[key] =
      child && typeof child === 'object'
        ? { ...(child as Record<string, unknown>) }
        : {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  const last = parts[parts.length - 1];
  if (value === undefined) {
    delete cursor[last];
  } else {
    cursor[last] = value;
  }
  return next;
}
