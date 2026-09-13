/**
 * Username format rules, for instant feedback while someone types. Mirrors
 * usernameFormatProblem() in server/index.js — the server is still the one
 * that decides, and it's the only place that knows what's taken or reserved.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

/** What the field should hold as someone types: usernames are lowercase, with no spaces. */
export function normalizeUsername(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, '');
}

/** A problem with the username's shape, or null if it's well-formed. */
export function usernameProblem(name: string): string | null {
  if (name.length < USERNAME_MIN || name.length > USERNAME_MAX) {
    return `Usernames are ${USERNAME_MIN}–${USERNAME_MAX} characters.`;
  }
  if (!/^[a-z0-9._]+$/.test(name)) {
    return 'Only letters, numbers, periods and underscores.';
  }
  if (name.startsWith('.') || name.endsWith('.')) return "Can't start or end with a period.";
  if (name.includes('..')) return "Can't have two periods in a row.";
  return null;
}

/** A rejection from the server ("that username is taken"), phrased like the messages above. */
export function usernameErrorMessage(err: unknown): string {
  const message = err instanceof Error && err.message ? err.message : 'Something went wrong. Try again';
  const sentence = message.charAt(0).toUpperCase() + message.slice(1);
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}
