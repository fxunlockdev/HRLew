/**
 * Form helpers shared by the server actions.
 */

/** FormData -> plain object, dropping empty strings so zod defaults apply. */
export function parseFormData(formData: FormData): Record<string, string> {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  Object.keys(raw).forEach((k) => {
    if (raw[k] === "") delete raw[k];
  });
  return raw;
}

/**
 * `undefined` -> `null`.
 *
 * Form fields the user cleared arrive as absent keys. PostgREST ignored absent
 * keys, which meant emptying a field in the UI silently did nothing; writing an
 * explicit null makes "clear the field" actually clear it. Every form that
 * reaches these actions posts its entity's full field set, so this cannot blank
 * a column the user never saw.
 */
export function orNull<T>(value: T | undefined): T | null {
  return value === undefined ? null : value;
}

/** Comma-separated input -> trimmed, de-duplicated string array. */
export function toStringArray(input: string | undefined): string[] {
  if (!input) return [];
  const seen = new Set<string>();
  for (const part of input.split(",")) {
    const trimmed = part.trim();
    if (trimmed) seen.add(trimmed);
  }
  return [...seen];
}
