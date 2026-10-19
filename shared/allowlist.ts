export function parseEmailAllowlist(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/[\s,;]+/)
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.includes("@")),
  );
}

export function emailIsAllowed(emails: string[], allowlist: Set<string>): boolean {
  return emails.some((email) => allowlist.has(email.trim().toLowerCase()));
}
