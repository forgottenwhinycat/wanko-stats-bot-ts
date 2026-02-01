import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AttachmentBuilder,
} from "discord.js";
import sharp from "sharp";
import { getLeaderboard } from "../firebase/db";
import path from "path";

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
        { name: "Денна голосова активність", value: "voice_day" },
        { name: "Репутація", value: "rep" }
      )
  );

// Форматування голосового часу
function formatVoiceTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}h ${m.toString().padStart(2, "0")}m`;
}

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const category = interaction.options.getString("category")!;
  const guildId = interaction.guildId!;

  // Визначаємо період для leaderboard
  const period: "all" | "day" = category === "voice_day" ? "day" : "all";

  // Отримуємо лідерборд
  const leaderboard = await getLeaderboard(guildId, period);

// Відфільтрувати топ-5 і відформатувати значення
const top5: { userId: string; name: string; avatar: string; value: number | string }[] =
  leaderboard
    .map((entry) => {
      const user = interaction.client.users.cache.get(entry.userId);
      const avatar =
        user?.displayAvatarURL({ extension: "png", size: 256 }) ||
        "https://cdn.discordapp.com/embed/avatars/0.png";

      let value: number | string = 0;

      switch (category) {
        case "balance":
          value = entry.stats.balance;
          break;
        case "messages":
          value = entry.stats.messages;
          break;
        case "voice":
        case "voice_day":
          value = entry.stats.voiceMinutes;
          break;
        case "rep":
          value = entry.stats.rep;
          break;
      }

      return { userId: entry.userId, name: user?.username || "Unknown", avatar, value };
    })
    // Відфільтрувати користувачів без ніку
    .filter((entry) => entry.name !== "Unknown")
    .sort((a, b) => {
      if (typeof a.value === "number" && typeof b.value === "number") {
        return b.value - a.value;
      }
      return 0;
    })
    .slice(0, 5);


  // Підготовка відображуваних значень для голосу
  top5.forEach((entry) => {
    if (category === "voice" || category === "voice_day") {
      entry.value = formatVoiceTime(entry.value as number);
    }
  });

  // Фон
  const background = sharp(path.join(__dirname, "../../images/image.png")).resize(1500, 800);

  // Аватари
  const avatarBuffers = await Promise.all(
    top5.map(async (u) => {
      const fetched = await fetch(u.avatar);
      const arrayBuffer = await fetched.arrayBuffer();
      return sharp(Buffer.from(arrayBuffer))
        .resize(120, 120)
        .composite([
          {
            input: Buffer.from(`
              <svg width="120" height="120">
                <clipPath id="clip">
                  <circle cx="60" cy="60" r="58"/>
                </clipPath>
                <image href="${u.avatar}" width="120" height="120" clip-path="url(#clip)" preserveAspectRatio="xMidYMid slice"/>
              </svg>
            `),
            blend: "dest-in",
          },
        ])
        .png()
        .toBuffer();
    })
  );

  // Рядки
  const startY = 185;
  const rowHeight = 100;
  const rowSpacing = 20;
  const spacingDecrease = 4;
  const rowsY = Array.from({ length: 5 }, (_, i) => {
    let extraSpacing = i * (rowSpacing - spacingDecrease * i);
    let y = startY + i * rowHeight + extraSpacing;

    if (i == 1) y -= 5;
    if (i >= 3) y += 10;
    if (i >= 4) y += 15;
    return y;
  });

  // SVG
  let svg = `
  <svg width="1500" height="800" xmlns="http://www.w3.org/2000/svg">
    <style>
      .title { fill: #ffffff; font-size: 60px; font-family: sans-serif; font-weight: bold; text-anchor: middle; }
      .row-bg { fill: transparent; stroke: transparent; rx: 30; ry: 30; }
      .name { fill: #ffffff; font-size: 36px; font-weight: bold; font-family: sans-serif; }
      .value { fill: #ffffff; font-size: 36px; font-family: sans-serif; font-weight: bold; text-anchor: end; }
    </style>
    <text x="750" y="135" class="title">
        ТОП 5 ${category === "voice_day" 
            ? "DAILY VOICE" 
            : category === "rep" 
            ? "REPUTATION" 
            : category.toUpperCase().replace("VOICE", "VOICE")}
    </text>

  `;

  top5.forEach((u, i) => {
    const y = rowsY[i];
    const centerY = y + rowHeight / 2;
    svg += `
      <rect x="150" y="${y}" width="1200" height="${rowHeight}" class="row-bg"/>
      <text x="350" y="${centerY + 12}" class="name">${u.name}</text>
      <text x="1120" y="${centerY + 12}" class="value">${u.value}</text>
    `;
  });

  svg += `</svg>`;

  // COMPOSITE
  const composites = [
    ...avatarBuffers.map((buf, i) => {
      const y = rowsY[i];
      const centerY = y + rowHeight / 2;
      return { input: buf, top: centerY - 60, left: 170 };
    }),
    { input: Buffer.from(svg), top: 0, left: 0 },
  ];

  const finalImage = await background.composite(composites).png().toBuffer();
  const file = new AttachmentBuilder(finalImage, { name: "top.png" });
  await interaction.editReply({ files: [file] });
}
