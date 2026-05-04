export function getInitials(firstName?: string | null, lastName?: string | null): string {
  const parts = [firstName, lastName]
    .map((value) => value?.trim() ?? "")
    .filter(Boolean)
    .flatMap((value) => value.split(/[\s-]+/).filter(Boolean));

  return parts
    .slice(0, 2)
    .map((part) => Array.from(part)[0] ?? "")
    .join("")
    .toUpperCase();
}

export function getDisplayName(firstName?: string | null, lastName?: string | null): string {
  return [firstName?.trim(), lastName?.trim()].filter(Boolean).join(" ");
}
