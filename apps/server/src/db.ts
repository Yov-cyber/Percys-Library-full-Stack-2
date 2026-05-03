import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export async function ensureSettings(ownerId = "default") {
  const existing = await prisma.settings.findUnique({ where: { ownerId } });
  if (!existing) {
    await prisma.settings.create({ data: { ownerId } });
  }
}
