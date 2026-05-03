const OWNER_KEY = "pl_owner_id";
const SINGLE_OWNER_ID = "percy-default";

export function getOwnerId(): string {
  const existing = localStorage.getItem(OWNER_KEY)?.trim();
  if (existing) return existing;
  localStorage.setItem(OWNER_KEY, SINGLE_OWNER_ID);
  return SINGLE_OWNER_ID;
}

export function switchOwnerId(next?: string): string {
  const id = next?.trim() || SINGLE_OWNER_ID;
  localStorage.setItem(OWNER_KEY, id);
  return id;
}

export function listOwnerIds(): string[] {
  return [getOwnerId()];
}
