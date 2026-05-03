import { Router } from "express";
import { prisma } from "../db";
import { ACHIEVEMENTS, computeContext, evaluateAchievements } from "../services/achievements";
import { asyncHandler } from "../lib/async-handler";
import { getOwnerId } from "../lib/owner";

export const statsRouter = Router();

interface MinComic {
  id: string;
  title: string;
  format: string;
  pageCount: number;
  currentPage: number;
  completed: boolean;
  category: string | null;
  sizeBytes: bigint;
  lastReadAt: Date | null;
}

statsRouter.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const ownerId = getOwnerId(req);
    const ctx = await computeContext(ownerId);
    const totalComics = await prisma.comic.count({ where: { ownerId } });
    const days = await prisma.readingDay.findMany({ where: { ownerId }, orderBy: { date: "asc" } });
    const allComics = (await prisma.comic.findMany({
      where: { ownerId },
      select: {
        id: true,
        title: true,
        format: true,
        pageCount: true,
        currentPage: true,
        completed: true,
        category: true,
        sizeBytes: true,
        lastReadAt: true,
      },
    })) as MinComic[];

    // Format and category histograms (ordered by count desc, with "Sin categoría"
    // bucket for null categories so the chart doesn't silently drop them).
    const formatMap = new Map<string, number>();
    const categoryMap = new Map<string, number>();
    for (const c of allComics) {
      formatMap.set(c.format, (formatMap.get(c.format) ?? 0) + 1);
      const cat = c.category && c.category.trim() ? c.category : "Sin categoría";
      categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + 1);
    }
    const formats = Array.from(formatMap, ([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
    const categories = Array.from(categoryMap, ([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);

    // Pages-read estimate per comic, used to rank "topRead" and "almostDone".
    const withProgress = allComics.map((c) => ({
      id: c.id,
      title: c.title,
      format: c.format,
      pageCount: c.pageCount,
      currentPage: c.currentPage,
      completed: c.completed,
      pagesEstimated: c.completed ? c.pageCount : Math.min(c.currentPage + 1, c.pageCount),
      lastReadAt: c.lastReadAt,
    }));

    const topRead = [...withProgress]
      .sort((a, b) => b.pagesEstimated - a.pagesEstimated)
      .slice(0, 5)
      .map(({ lastReadAt: _l, ...rest }) => rest);

    const almostDone = withProgress
      .filter(
        (c) => !c.completed && c.pageCount > 0 && c.pagesEstimated / c.pageCount >= 0.7,
      )
      .sort((a, b) => b.pagesEstimated - a.pagesEstimated)
      .slice(0, 3)
      .map(({ lastReadAt: _l, ...rest }) => rest);

    const lastCompletedRaw = withProgress
      .filter((c) => c.completed)
      .sort((a, b) => {
        const at = a.lastReadAt ? a.lastReadAt.getTime() : 0;
        const bt = b.lastReadAt ? b.lastReadAt.getTime() : 0;
        return bt - at;
      })[0];
    const lastCompleted = lastCompletedRaw
      ? (() => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { lastReadAt: _unused, ...rest } = lastCompletedRaw;
          return rest;
        })()
      : null;

    const totalBytes = allComics.reduce((acc, c) => acc + Number(c.sizeBytes), 0);
    const activeDays = days.filter((d) => d.pagesRead > 0).length;
    const averagePagesPerActiveDay =
      activeDays > 0 ? Math.round((ctx.totalPages / activeDays) * 10) / 10 : 0;
    const inProgressComics = withProgress.filter(
      (c) => !c.completed && c.currentPage > 0 && c.pageCount > 0,
    ).length;

    res.json({
      totalComics,
      completedComics: ctx.totalRead,
      inProgressComics,
      pagesRead: ctx.totalPages,
      favorites: ctx.favorites,
      currentStreak: ctx.currentStreak,
      longestStreak: ctx.longestStreak,
      todayPages: ctx.todayPages,
      bestDayPages: ctx.bestDayPages,
      days,
      totalReadingDays: ctx.totalReadingDays,
      daysActive7: ctx.daysActive7,
      daysActive30: ctx.daysActive30,
      formats,
      categories,
      topRead,
      almostDone,
      lastCompleted,
      totalBytes,
      averagePagesPerActiveDay,
    });
  }),
);

statsRouter.get(
  "/achievements",
  asyncHandler(async (req, res) => {
    const ownerId = getOwnerId(req);
    await evaluateAchievements(ownerId);
    const unlockedRows = (await prisma.achievement.findMany({ where: { ownerId } })) as Array<{ id: string }>;
    const unlocked = new Set(unlockedRows.map((a: { id: string }) => a.id));
    res.json(
      ACHIEVEMENTS.map((a) => {
        const isUnlocked = unlocked.has(a.id);
        return {
          id: a.id,
          // Hide secret achievements until unlocked: the UI shows a placeholder
          // so the user is encouraged to discover them.
          title: a.secret && !isUnlocked ? "???" : a.title,
          description: a.secret && !isUnlocked ? "Logro secreto" : a.description,
          group: a.group,
          tier: a.tier ?? 1,
          secret: !!a.secret,
          unlocked: isUnlocked,
        };
      }),
    );
  }),
);
