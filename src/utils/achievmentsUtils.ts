import { EmbedBuilder, User } from "discord.js";
import { getUserStats, formatVoiceTime } from "../firebase/db";
import { ACHIEVEMENTS } from "./achievementsList";
import { AchievementData, AchievementPage } from "../types/types";


export async function getAchievementData(
  guildId: string,
  userId: string
): Promise<AchievementData> {
  const statsRaw = await getUserStats(guildId, userId, "all");

  const stats = {
    messages: Number(statsRaw.messages) || 0,
    voiceMinutes: Number(statsRaw.voiceMinutes) || 0,
  };

  const allAchievements = [...ACHIEVEMENTS.messages, ...ACHIEVEMENTS.voice];
  const completed = allAchievements.filter((a) => a.check(stats)).length;
  const total = allAchievements.length;
  const percent = total === 0 ? 0 : Math.floor((completed / total) * 100);

  return { total, completed, percent, stats };
}

export function buildAchievementPages(
  user: User,
  data: AchievementData
): Record<AchievementPage, () => EmbedBuilder> {
  const { total, completed, stats } = data;

  return {
    main: () =>
      new EmbedBuilder()
        .setColor("#0D1117")
        .setAuthor({
          name: `🏅 Досягнення ${user.username}`,
          iconURL: user.displayAvatarURL({ size: 128 }),
        })
        .setThumbnail(user.displayAvatarURL({ size: 256 }))
        .setDescription(
          `💠 **Виконано досягнень:** ${completed}/${total} (${data.percent}%)\n\n` +
            `**💬 Повідомлення:** ${stats.messages.toLocaleString()}\n` +
            `**🎧 Голосовий час:** ${formatVoiceTime(stats.voiceMinutes)}\n\n` +
            `Перемикай сторінки нижче, щоб побачити свої ачівки 👇`
        )
        .setFooter({ text: "Сторінка 1/3 — Загальна статистика" })
        .setTimestamp(),

    messages: () =>
      new EmbedBuilder()
        .setColor("#1F6FEB")
        .setAuthor({
          name: `💬 Повідомлення — Досягнення`,
          iconURL: user.displayAvatarURL({ size: 128 }),
        })
        .setDescription(
          ACHIEVEMENTS.messages
            .map((a) =>
              a.check(stats)
                ? `✅ ${a.icon} **${a.name}** — ${a.description}`
                : `❌ ${a.icon} **${a.name}** — ${a.description}`
            )
            .join("\n")
        )
        .setFooter({ text: "Сторінка 2/3 — Повідомлення" })
        .setTimestamp(),

    voice: () =>
      new EmbedBuilder()
        .setColor("#9C27B0")
        .setAuthor({
          name: `🎧 Голосовий час — Досягнення`,
          iconURL: user.displayAvatarURL({ size: 128 }),
        })
        .setDescription(
          ACHIEVEMENTS.voice
            .map((a) =>
              a.check(stats)
                ? `✅ ${a.icon} **${a.name}** — ${a.description}`
                : `❌ ${a.icon} **${a.name}** — ${a.description}`
            )
            .join("\n")
        )
        .setFooter({ text: "Сторінка 3/3 — Голосовий час" })
        .setTimestamp(),
  };
}
