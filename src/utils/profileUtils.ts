import { Period, getLevelFromXp, getXpForLevel } from "../firebase/db";
import { ProfileStats } from "../types/types";
import { ACHIEVEMENTS } from "./achievementsList";
export function generateProgressBar(percent: number, totalBars = 7): string {
  const filledBars = Math.round((percent / 100) * totalBars);
  return "🍀 ".repeat(filledBars) + "✩ ".repeat(totalBars - filledBars);
}
export function calculateLevelProgress(xp: number) {
  const level = getLevelFromXp(xp);
  const currentLevelXP = getXpForLevel(level);
  const nextLevelXP = getXpForLevel(level + 1);
  let progressPercent = Math.floor(
    ((xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100
  );
  progressPercent = Math.max(0, Math.min(progressPercent, 100));
  const progressBar = generateProgressBar(progressPercent);
  return { level, currentLevelXP, nextLevelXP, progressPercent, progressBar };
}
export function calculateAchievements(statsAll: { xp: number }) {
  const allAchievements = [...ACHIEVEMENTS.messages, ...ACHIEVEMENTS.voice];
  const completedAchievements = allAchievements.filter((a) =>
    a.check(statsAll)
  );
  const totalAchievements = allAchievements.length;
  const achievementsCount = completedAchievements.length;
  const achievementsPercent =
    totalAchievements === 0
      ? 0
      : Math.floor((achievementsCount / totalAchievements) * 100);
  return { achievementsCount, totalAchievements, achievementsPercent };
}
export function calculateProfileStats(statsAll: { xp: number }): ProfileStats {
  const levelData = calculateLevelProgress(statsAll.xp);
  const achievementData = calculateAchievements(statsAll);
  return { ...levelData, ...achievementData };
}
export function getPeriodName(period: Period): string {
  switch (period) {
    case "all":
      return "Весь час";
    case "day":
      return "Сьогодні";
    case "week":
      return "Тиждень";
    case "month":
      return "Місяць";
    case "year":
      return "Рік";
    default:
      return "Весь час";
  }
}
