export function parseEmailAllowlist(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/[\s,;]+/)
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.includes("@")),
  );
}

export function matchingAllowedEmail(emails: string[], allowlist: Set<string>): string | null {
  for (const email of emails) {
    const normalized = email.trim().toLowerCase();
    if (allowlist.has(normalized)) return normalized;
  }
  return null;
}

export function emailIsAllowed(emails: string[], allowlist: Set<string>): boolean {
  return matchingAllowedEmail(emails, allowlist) !== null;
}
