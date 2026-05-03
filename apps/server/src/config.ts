import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";

dotenv.config();

const root = path.resolve(__dirname, "..");
const prismaDir = path.resolve(root, "prisma");

function resolveDbPath(): string {
  const envUrl = process.env.DATABASE_URL ?? "";
  
  // If already a valid SQLite file URL with absolute path
  if (envUrl.startsWith("file:") && !envUrl.includes("./") && !envUrl.includes("../")) {
    return envUrl;
  }
  
  // Extract file path from "file:./dev.db" or similar
  let dbFile = "dev.db";
  if (envUrl.startsWith("file:")) {
    dbFile = envUrl.slice(5);
    if (dbFile.startsWith("/") || dbFile.startsWith("\\")) {
      dbFile = dbFile.slice(1);
    }
  } else if (envUrl) {
    dbFile = envUrl;
  }
  
  // Resolve relative to prisma directory
  if (dbFile.startsWith("./") || dbFile.startsWith("../") || !path.isAbsolute(dbFile)) {
    dbFile = path.resolve(prismaDir, dbFile);
  }
  
  return `file:${dbFile}`;
}

process.env.DATABASE_URL = resolveDbPath();

export const config = {
  port: parseInt(process.env.PORT ?? "4000", 10),
  databaseUrl: process.env.DATABASE_URL,
  libraryPath: resolveLibraryPath(),
  cacheDir: resolveCacheDir(),
  pageMemoryCacheItems: 60,
  thumbWidth: 320,
  coverWidth: 600,
};

function resolveLibraryPath(): string {
  const envPath = process.env.LIBRARY_PATH;
  // Default to scanning from data/ folder where user files are
  let defaultPath = path.resolve(root, "data");
  if (envPath) {
    // If explicitly set, use that path but resolve relative to root
    defaultPath = path.isAbsolute(envPath) ? envPath : path.resolve(root, envPath);
  }
  fs.mkdirSync(defaultPath, { recursive: true });
  console.log(`[config] library path: ${defaultPath}`);
  return defaultPath;
}

function resolveCacheDir(): string {
  const envPath = process.env.CACHE_DIR;
  if (!envPath) {
    const defaultPath = path.resolve(root, "cache");
    fs.mkdirSync(defaultPath, { recursive: true });
    return defaultPath;
  }
  const resolved = path.isAbsolute(envPath) ? envPath : path.resolve(root, envPath);
  fs.mkdirSync(resolved, { recursive: true });
  return resolved;
}
