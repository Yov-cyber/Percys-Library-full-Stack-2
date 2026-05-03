import type { Request } from "express";

export function getOwnerId(req: Request): string {
  const raw = req.header("x-owner-id")?.trim();
  if (!raw) return "default";
  return raw.slice(0, 64);
}

