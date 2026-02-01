import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { getXpForLevel } from "../firebase/db";

export const LEVELS_PER_PAGE = 20;
export const MAX_LEVEL = 300;

export function buildLevelEmbed(page: number) {
  const totalPages = Math.ceil(MAX_LEVEL / LEVELS_PER_PAGE);
  const start = (page - 1) * LEVELS_PER_PAGE + 1;
  const end = Math.min(start + LEVELS_PER_PAGE - 1, MAX_LEVEL);

  const lines: string[] = [];
  for (let lvl = start; lvl <= end; lvl++) {
    lines.push(
      `>  **${lvl} рівень** → ✨ ${getXpForLevel(lvl).toLocaleString()} XP`
    );
  }

  return new EmbedBuilder()
    .setColor("#313233")
    .setAuthor({ name: "XP для кожного рівня" })
    .setDescription(lines.join("\n"))
    .setFooter({ text: `Сторінка ${page} з ${totalPages}` })
    .setTimestamp();
}

export function buildLevelRow(page: number) {
  const totalPages = Math.ceil(MAX_LEVEL / LEVELS_PER_PAGE);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("prev")
      .setEmoji("⬅️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 1),
    new ButtonBuilder()
      .setCustomId("next")
      .setEmoji("➡️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === totalPages)
  );
}
