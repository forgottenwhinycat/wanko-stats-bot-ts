import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AttachmentBuilder,
  User,
} from "discord.js";

import sharp from "sharp";
import path from "path";

import { getUserStats, getLeaderboard, getMarriage } from "../firebase/db";


const bannerPath = path.join(__dirname, "../../images/profile.png");

function formatRank(rank: number): string {
  if (rank >= 1 && rank <= 15) return rank.toString();
  if (rank >= 16 && rank <= 25) return "15+";
  if (rank >= 26 && rank <= 50) return "25+";
  if (rank >= 51 && rank <= 100) return "50+";
  if (rank >= 101 && rank <= 250) return "100+";
  if (rank > 250) return "250+";
  return "0+";
}

export const data = new SlashCommandBuilder()
  .setName("profile")
  .setDescription("Показує красивий банер профілю користувача")
  .addUserOption((option) =>
    option
      .setName("user")
      .setDescription("Профіль якого користувача хочеш переглянути")
  );

function formatVoiceTimeHMS(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}h ${m.toString().padStart(2, "0")}m`;
}

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const guild = interaction.guild;
    if (!guild) throw new Error("Guild not found");

    await interaction.deferReply();

    const user: User = interaction.options.getUser("user") || interaction.user;

    const statsDay = await getUserStats(guild.id, user.id, "day");
    const statsAll = await getUserStats(guild.id, user.id, "all");

    const leaderboard = await getLeaderboard(guild.id, "all");
    const rank = leaderboard.findIndex((u) => u.userId === user.id) + 1;

    // ==========================
    // Аватар користувача
    // ==========================
    const avatarBuffer = await fetch(
      user.displayAvatarURL({ extension: "png", size: 512 })
    ).then((r) => r.arrayBuffer());

    const avatarCircle = await sharp(Buffer.from(avatarBuffer))
      .resize(330, 330)
      .composite([{
        input: Buffer.from(`
          <svg width="330" height="330">
            <circle cx="165" cy="165" r="165" fill="white"/>
          </svg>
        `),
        blend: "dest-in",
      }])
      .png()
      .toBuffer();

    const avatarX = 513;
    const avatarY = 297;
    const avatarSize = 330;
    const blockWidth = 800;
    const blockHeight = 60;

    function fitUsername(username: string, maxWidth: number, fontSize: number): string {
      const avgCharWidth = fontSize * 0.6;
      const maxChars = Math.floor(maxWidth / avgCharWidth);
      if (username.length > maxChars) {
        return username.slice(0, maxChars - 3) + "...";
      }
      return username;
    }

    const displayedUsername = fitUsername(user.username, blockWidth, 108);

    const usernameSvg = `
      <svg width="${blockWidth}" height="${blockHeight + 80}">
        <style>
          @font-face {
            font-family: "MontserratBold";
            src: url("file://${path.join(__dirname, "../fonts/Montserrat-Bold.ttf")}") format("truetype");
            font-weight: 700;
            font-style: normal;
          }
        </style>
        <text 
          x="50%" 
          y="${(blockHeight + 80) / 2}" 
          text-anchor="middle" 
          dominant-baseline="middle"
          font-family="MontserratBold" 
          font-size="104" 
          font-weight="700" 
          fill="#ffffff">
          ${displayedUsername}
        </text>
      </svg>
    `;

    const usernameX = avatarX + Math.round(avatarSize / 2 - blockWidth / 2);
    const usernameY = avatarY + avatarSize + 40;

    // ==========================
    // Grid статистики
    // ==========================
    const gridOffsetX = 1560;
    const gridOffsetY = 230;
    const colGap = 300;
    const rowGap = 150;
    const colWidth = 250;
    const rowHeight = 105;

    function gridItem(value: string | number) {
      return `
      <svg width="${colWidth}" height="${rowHeight}">
        <style>
          @font-face {
            font-family: "MontserratSemiBold";
            src: url("file://${path.join(__dirname, "../fonts/Montserrat-SemiBold.ttf")}") format("truetype");
            font-weight: 600;
          }
        </style>
        <text x="0" y="55" font-size="46" fill="#ffffff" text-anchor="start"
          font-family="MontserratSemiBold" font-weight="600">
          ${value}
        </text>
      </svg>`;
    }

    const gridElements = [
      gridItem(statsAll.rep),
      gridItem(statsAll.balance),
      gridItem(statsAll.messages),
      gridItem(formatVoiceTimeHMS(statsDay.voiceMinutes)),
      gridItem(formatRank(rank)),
      gridItem(formatVoiceTimeHMS(statsAll.voiceMinutes)),
    ];

    const compositesGrid = gridElements.map((svg, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      return {
        input: Buffer.from(svg),
        left: gridOffsetX + col * (colWidth + colGap),
        top: gridOffsetY + row * (rowHeight + rowGap),
      };
    });

    // ==========================
    // Аватар і нік партнера (якщо є)
    // ==========================
    const partnerId = await getMarriage(guild.id, user.id);
    let partnerComposite: { input: Buffer; left: number; top: number; }[] = [];

    const partnerX = 215;
    const partnerY = 1023;
    const maxTextWidth = 600;

    if (partnerId) {
      // Партнер є
      const partnerUser = await guild.members.fetch(partnerId).then(m => m.user);

      const partnerAvatarBuffer = await fetch(
        partnerUser.displayAvatarURL({ extension: "png", size: 256 })
      ).then(r => r.arrayBuffer());

      const partnerCircle = await sharp(Buffer.from(partnerAvatarBuffer))
        .resize(110, 110)
        .composite([{
          input: Buffer.from(`
            <svg width="110" height="110">
              <rect x="0" y="0" width="110" height="110" rx="15" ry="15" fill="white"/>
            </svg>
          `),
          blend: "dest-in",
        }])
        .png()
        .toBuffer();

      function fitText(text: string, maxWidth: number, initialSize: number) {
        const avgCharWidth = initialSize * 0.6;
        const maxChars = Math.floor(maxWidth / avgCharWidth);
        if (text.length > maxChars) return { text: text.slice(0, maxChars - 3) + "...", size: initialSize };
        return { text, size: initialSize };
      }

      const { text: partnerName, size: fontSize } = fitText(partnerUser.username, maxTextWidth, 50);

      const partnerNameSvg = `
        <svg width="${maxTextWidth}" height="150">
          <style>
            @font-face {
              font-family: "MontserratBold";
              src: url("file://${path.join(__dirname, "../fonts/Montserrat-Bold.ttf")}") format("truetype");
              font-weight: 700;
            }
          </style>
          <text 
            x="0" 
            y="50%" 
            dominant-baseline="middle"
            font-family="MontserratBold" 
            font-size="${fontSize}" 
            font-weight="700"
            fill="#ffffff">
            ${partnerName}
          </text>
        </svg>
      `;

      partnerComposite = [
        { input: partnerCircle, left: partnerX, top: partnerY },
        { input: Buffer.from(partnerNameSvg), left: partnerX + 125, top: partnerY }
      ];
    } else {
      // Партнера немає
      const noPartnerSquare = await sharp({
        create: {
          width: 110,
          height: 110,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 } // чорний квадрат
        }
      }).composite([{
    input: Buffer.from(`
      <svg width="110" height="110">
        <rect x="0" y="0" width="110" height="110" rx="15" ry="15" fill="white"/>
      </svg>
    `),
    blend: "dest-in",
  }]).png().toBuffer();

      const noPartnerSvg = `
        <svg width="${maxTextWidth}" height="150">
          <style>
            @font-face {
              font-family: "MontserratBold";
              src: url("file://${path.join(__dirname, "../fonts/Montserrat-Bold.ttf")}") format("truetype");
              font-weight: 700;
            }
          </style>
          <text 
            x="0" 
            y="50%" 
            dominant-baseline="middle"
            font-family="MontserratBold" 
            font-size="50" 
            font-weight="700"
            fill="#ffffff">
            У вас немає пари
          </text>
        </svg>
      `;

      partnerComposite = [
        { input: noPartnerSquare, left: partnerX, top: partnerY },
        { input: Buffer.from(noPartnerSvg), left: partnerX + 125, top: partnerY }
      ];
    }

    // ==========================
    // Збірка банера
    // ==========================
    const result = await sharp(bannerPath)
      .composite([
        { input: avatarCircle, left: avatarX, top: avatarY },
        { input: Buffer.from(usernameSvg), left: usernameX, top: Math.round(usernameY) },
        ...compositesGrid,
        ...partnerComposite,
      ])
      .png()
      .toBuffer();

    const attachment = new AttachmentBuilder(result, { name: "profile.png" });
    await interaction.editReply({ files: [attachment] });
  } catch (err) {
    console.error("Profile command error:", err);
    await interaction.editReply("⚠️ Помилка при створенні профілю!");
  }
}
