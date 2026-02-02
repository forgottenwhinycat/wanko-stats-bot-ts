export interface Achievement {
  name: string;
  description: string;
  check: (stats: any) => boolean;
  icon: string;
  points?: number;
  tier?: number;
}

export interface ProfileStats {
  level: number;
  currentLevelXP: number;
  nextLevelXP: number;
  progressPercent: number;
  progressBar: string;
  achievementsCount: number;
  totalAchievements: number;
  achievementsPercent: number;
}

export interface LeaderboardUser {
  userId: string;
  stats: {
    xp: number;
    level: number;
    messages: number;
    voiceMinutes: number;
  };
}

export type AchievementPage = "main" | "messages" | "voice";

export interface AchievementData {
  total: number;
  completed: number;
  percent: number;
  stats: {
    messages: number;
    voiceMinutes: number;
  };
}

export type Period = "all" | "day" | "week" | "month" | "year";

export interface UserStats {
  xp: number;
  level: number;
  messages: number;
  voiceMinutes: number;
  balance: number;
  rep: number
}

export interface ShopItem {
  roleId: string;
  name: string;
  price: number;
}

