import { SlashCommandBuilder, ChatInputCommandInteraction, AttachmentBuilder } from "discord.js";
import sharp from "sharp";
import path from "path";

import { getLeaderboard } from "../firebase/db";
import { TopLayout, formatVoiceTime, getRowsY, buildTopSvg, buildAvatarBuffers } from "../utils/commands/top/topUtils";

export const data = new SlashCommandBuilder()
  .setName("top")
  .setDescription("Показує топ учасників")
  .addStringOption((o) =>
    o
      .setName("category")
      .setDescription("Оберіть категорію")
      .setRequired(true)
      .addChoices(
        { name: "Баланс", value: "balance" },
        { name: "Повідомлення", value: "messages" },
        { name: "Голосова активність", value: "voice" },
        { name: "Денна голосова активність", value: "voice_day" }
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const category = interaction.options.getString("category", true);
  const guildId = interaction.guildId!;
  const period: "all" | "day" = category === "voice_day" ? "day" : "all";

  const leaderboard = await getLeaderboard(guildId, period);

  const top5: { userId: string; name: string; avatar: string; value: string | number }[] = leaderboard
    .map((entry) => {
      const user = interaction.client.users.cache.get(entry.userId);
      const avatar =
        user?.displayAvatarURL({ extension: "png", size: 256 }) ||
        "https://cdn.discordapp.com/embed/avatars/0.png";

      let value: number | string = 0;
      switch (category) {
        case "balance": value = entry.stats.balance; break;
        case "messages": value = entry.stats.messages; break;
        case "voice":
        case "voice_day": value = entry.stats.voiceMinutes; break;
      }

      return {
        userId: entry.userId,
        name: user?.username || "Unknown",
        avatar,
        value,
      };
    })
    .filter((e) => e.name !== "Unknown")
    .sort((a, b) => (typeof a.value === "number" && typeof b.value === "number" ? b.value - a.value : 0))
    .slice(0, 5);

  if (category === "voice" || category === "voice_day") {
    top5.forEach((e) => {
      e.value = formatVoiceTime(e.value as number);
    });
  }

  const background = sharp(path.join(__dirname, "../../images/image.png")).resize(TopLayout.width, TopLayout.height);
  const avatarBuffers = await buildAvatarBuffers(top5);
  const rowsY = getRowsY(top5.length);
  const svg = buildTopSvg(category, top5, rowsY);

  const composites = [
    ...avatarBuffers.map((buf, i) => ({
      input: buf,
      top: rowsY[i] + TopLayout.rowHeight / 2 - TopLayout.avatarSize / 2,
      left: TopLayout.avatarX,
    })),
    { input: Buffer.from(svg), top: 0, left: 0 },
  ];

  const finalImage = await background.composite(composites).png().toBuffer();
  const file = new AttachmentBuilder(finalImage, { name: "top.png" });
  await interaction.editReply({ files: [file] });
}
