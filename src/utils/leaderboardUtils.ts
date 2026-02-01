import {
  Guild,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  GuildMemberManager,
} from "discord.js";
import { LeaderboardUser } from "../types/types";
import { formatVoiceTime } from "../firebase/db";

export const USERS_PER_PAGE = 8;

export function getTotalPages(totalUsers: number): number {
  return Math.ceil(totalUsers / USERS_PER_PAGE);
}

export function getPageData(
  users: LeaderboardUser[],
  page: number
): LeaderboardUser[] {
  return users.slice(page * USERS_PER_PAGE, (page + 1) * USERS_PER_PAGE);
}

export function buildLeaderboardEmbed(
  guild: Guild,
  pageUsers: LeaderboardUser[],
  allUsers: LeaderboardUser[],
  page: number,
  totalPages: number,
  periodName: string,
  members: GuildMemberManager
): EmbedBuilder {
  const medals = ["🥇", "🥈", "🥉"];

  const lines = pageUsers.map((user, index) => {
    const member = members.cache.get(user.userId);
    const name = member?.displayName || member?.user.username || "Невідомо";

    const { xp = 0, level = 0, messages = 0, voiceMinutes = 0 } = user.stats;
    const globalUser = allUsers.find((u) => u.userId === user.userId);
    const totalXp = globalUser?.stats.xp ?? xp;

    const globalIndex = page * USERS_PER_PAGE + index + 1;
    const medal = medals[globalIndex - 1] || `#${globalIndex}`;

    return (
      `${medal} **${name}**\n` +
      `> 💫 **Рівень:** ${level}   ✨ **${xp.toLocaleString()} досвіду**` +
      (periodName !== "Весь час"
        ? ` *(усього ${totalXp.toLocaleString()})*`
        : "") +
      `\n> 💬 ${messages.toLocaleString()} повідомлень   🎧 ${formatVoiceTime(
        voiceMinutes
      )}`
    );
  });

  return new EmbedBuilder()
    .setColor("#2e3033")
    .setAuthor({
      name: `🏆 Таблиця лідерів`,
      iconURL: guild.iconURL({ size: 128 }) || undefined,
    })
    .setDescription(lines.join("\n\n"))
    .setFooter({
      text: `📆 ${periodName} • Сторінка ${page + 1}/${totalPages}`,
    });
}

export function buildLeaderboardRow(
  currentPage: number,
  totalPages: number
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("prev")
      .setEmoji("⬅️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === 0),
    new ButtonBuilder()
      .setCustomId("next")
      .setEmoji("➡️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === totalPages - 1)
  );
}
