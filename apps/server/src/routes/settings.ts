import { Router } from "express";
import { z } from "zod";
import { ensureSettings, prisma } from "../db";
import { asyncHandler } from "../lib/async-handler";
import { getOwnerId } from "../lib/owner";

export const settingsRouter = Router();

settingsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const ownerId = getOwnerId(req);
    await ensureSettings(ownerId);
    const settings = await prisma.settings.findUnique({ where: { ownerId } });
    res.json(settings);
  }),
);

// Avatars are either a built-in preset reference or a small data URL.
// Cap the data URL at ~256KB encoded to keep a single Settings row sane.
const AVATAR_MAX_LEN = 350_000;
const avatarSchema = z
  .string()
  .max(AVATAR_MAX_LEN)
  .regex(/^(preset:[a-z0-9-]{1,32}|data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+)$/);

const settingsSchema = z.object({
  // userName may be empty while the user is still onboarding; the UI
  // falls back to a "Lector" placeholder until they fill it in.
  userName: z.string().max(40).optional(),
  userLastName: z.string().max(40).nullable().optional(),
  // Theme id matches one of the presets in apps/web/src/lib/themes.ts. We
  // keep this open-ended (string) so the client can ship new themes
  // without a backend change. The shape is constrained to be safe.
  theme: z.string().regex(/^[a-z0-9-]{1,32}$/).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  avatar: avatarSchema.nullable().optional(),
  coverSize: z.enum(["sm", "md", "lg"]).optional(),
  readingMode: z.enum(["scroll-v", "paged-h", "paged-v", "webtoon", "paged-h-2"]).optional(),
  fitMode: z.enum(["fit-width", "fit-height", "original"]).optional(),
  direction: z.enum(["ltr", "rtl"]).optional(),
  showThumbStrip: z.boolean().optional(),
  autoCropMargins: z.boolean().optional(),
  uiHideDelayMs: z.number().int().min(1000).max(60_000).optional(),
  autoAdvanceToNext: z.boolean().optional(),
  autoScrollSpeed: z.number().int().min(10).max(400).optional(),
  showTopProgress: z.boolean().optional(),
  libraryView: z.enum(["grid", "list"]).optional(),
  librarySort: z.enum(["title", "lastReadAt", "progress", "addedAt"]).optional(),
  reduceMotion: z.boolean().optional(),
  imageFilter: z.enum(["none", "sepia", "night", "high-contrast"]).optional(),
  libraryPath: z.string().optional(),
  dailyGoalPages: z.number().int().min(0).max(2_000).optional(),
  customThemes: z.string().optional(),
  keyboardShortcuts: z.string().optional(),
  hasOnboarded: z.boolean().optional(),
  autoApplySettings: z.boolean().optional(),
  animationsEnabled: z.boolean().optional(),
  animPageTransitions: z.boolean().optional(),
  animHoverParallax: z.boolean().optional(),
  animHudFades: z.boolean().optional(),
  animMicroInteractions: z.boolean().optional(),
  animBrandShimmer: z.boolean().optional(),
  animIntensity: z.number().int().min(0).max(100).optional(),
  readerPageGap: z.number().int().min(0).max(80).optional(),
  readerMaxWidth: z.number().int().min(0).max(2400).optional(),
  readerSidePadding: z.number().int().min(0).max(120).optional(),
  readerPagePreload: z.number().int().min(0).max(20).optional(),
  imageQuality: z.enum(["high", "balanced", "fast"]).optional(),
  // Custom CSS is sandboxed only by length; the client appends it to its
  // own runtime stylesheet, so we just keep the row from blowing up.
  customCss: z.string().max(20_000).optional(),
  // backgroundImage shares the avatar storage shape (data URI or empty).
  backgroundImage: z
    .string()
    .max(1_500_000)
    .nullable()
    .optional(),
  backgroundDim: z.number().int().min(0).max(100).optional(),
  fontScale: z.number().int().min(80).max(130).optional(),
  statsRange: z.enum(["7d", "30d", "90d", "1y", "all"]).optional(),
});

settingsRouter.put(
  "/",
  asyncHandler(async (req, res) => {
    const ownerId = getOwnerId(req);
    await ensureSettings(ownerId);
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const updated = await prisma.settings.update({ where: { ownerId }, data: parsed.data });
    res.json(updated);
  }),
);

settingsRouter.post(
  "/reset-profile",
  asyncHandler(async (req, res) => {
    const ownerId = getOwnerId(req);
    await ensureSettings(ownerId);
    await prisma.$transaction([
      prisma.bookmark.deleteMany({ where: { ownerId } }),
      prisma.comic.deleteMany({ where: { ownerId } }),
      prisma.readingDay.deleteMany({ where: { ownerId } }),
      prisma.achievement.deleteMany({ where: { ownerId } }),
      prisma.settings.update({
        where: { ownerId },
        data: {
          userName: "",
          userLastName: null,
          avatar: null,
          dailyGoalPages: 0,
          hasOnboarded: false,
          autoApplySettings: true,
          animationsEnabled: true,
          customThemes: "[]",
          keyboardShortcuts: "{}",
          customCss: "",
          backgroundImage: null,
          // Reset visual companions too so a fresh profile starts with
          // defaults end-to-end (no stale dim/font scale/anim intensity
          // bleeding into a brand-new onboarding flow).
          backgroundDim: 60,
          fontScale: 100,
          animIntensity: 100,
          animPageTransitions: true,
          animHoverParallax: true,
          animHudFades: true,
          animMicroInteractions: true,
          animBrandShimmer: true,
          statsRange: "30d",
        },
      }),
    ]);
    res.json({ ok: true });
  }),
);

settingsRouter.post(
  "/reset-defaults",
  asyncHandler(async (req, res) => {
    const ownerId = getOwnerId(req);
    await ensureSettings(ownerId);
    const updated = await prisma.settings.update({
      where: { ownerId },
      data: {
        theme: "dark",
        accentColor: "#7c5cff",
        coverSize: "md",
        readingMode: "paged-h",
        fitMode: "fit-width",
        direction: "ltr",
        showThumbStrip: true,
        autoCropMargins: false,
        uiHideDelayMs: 2500,
        autoAdvanceToNext: false,
        autoScrollSpeed: 80,
        showTopProgress: true,
        libraryView: "grid",
        librarySort: "lastReadAt",
        reduceMotion: false,
        imageFilter: "none",
        dailyGoalPages: 0,
        customThemes: "[]",
        keyboardShortcuts: "{}",
        autoApplySettings: true,
        animationsEnabled: true,
        animPageTransitions: true,
        animHoverParallax: true,
        animHudFades: true,
        animMicroInteractions: true,
        animBrandShimmer: true,
        animIntensity: 100,
        readerPageGap: 8,
        readerMaxWidth: 900,
        readerSidePadding: 0,
        readerPagePreload: 3,
        imageQuality: "balanced",
        customCss: "",
        backgroundImage: null,
        backgroundDim: 60,
        fontScale: 100,
        statsRange: "30d",
      },
    });
    res.json(updated);
  }),
);
