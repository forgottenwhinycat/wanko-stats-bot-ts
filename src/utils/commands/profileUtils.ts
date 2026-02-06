// src/utils/commands/profileUtils.ts
import path from "path";
import sharp from "sharp";
import { Guild, User } from "discord.js";
import { getMarriage } from "../../firebase/db";

// ==========================
// Форматування рейтингу
// ==========================
export function formatRank(rank: number): string {
  if (rank >= 1 && rank <= 15) return rank.toString();
  if (rank >= 16 && rank <= 25) return "15+";
  if (rank >= 26 && rank <= 50) return "25+";
  if (rank >= 51 && rank <= 100) return "50+";
  if (rank >= 101 && rank <= 250) return "100+";
  if (rank > 250) return "250+";
  return "0+";
}

// ==========================
// Форматування часу голосу
// ==========================
export function formatVoiceTimeHMS(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}h ${m.toString().padStart(2, "0")}m`;
}

// ==========================
// Обрізання імені, щоб влазило
// ==========================
export function fitUsername(username: string, maxWidth: number, fontSize: number): string {
  const avgCharWidth = fontSize * 0.6;
  const maxChars = Math.floor(maxWidth / avgCharWidth);
  if (username.length > maxChars) return username.slice(0, maxChars - 3) + "...";
  return username;
}

// ==========================
// SVG для імені
// ==========================
export function buildUsernameSvg(username: string): string {
  const fontPath = path.join(__dirname, "../../fonts/Montserrat-Bold.ttf");
  const blockWidth = 800;
  const blockHeight = 140;

  return `
    <svg width="${blockWidth}" height="${blockHeight}">
      <style>
        @font-face {
          font-family: "MontserratBold";
          src: url("file://${fontPath}") format("truetype");
          font-weight: 700;
          font-style: normal;
        }
      </style>
      <text 
        x="50%" 
        y="50%" 
        text-anchor="middle" 
        dominant-baseline="middle"
        font-family="MontserratBold" 
        font-size="104" 
        font-weight="700" 
        fill="#ffffff">
        ${username}
      </text>
    </svg>
  `;
}

// ==========================
// SVG для однієї клітинки статистики
// ==========================
export function buildGridItemSvg(value: string | number): string {
  const fontPath = path.join(__dirname, "../../fonts/Montserrat-SemiBold.ttf");

  return `
    <svg width="250" height="105">
      <style>
        @font-face {
          font-family: "MontserratSemiBold";
          src: url("file://${fontPath}") format("truetype");
          font-weight: 600;
        }
      </style>
      <text x="0" y="55" font-size="46" fill="#ffffff" text-anchor="start"
        font-family="MontserratSemiBold" font-weight="600">
        ${value}
      </text>
    </svg>
  `;
}

// ==========================
// Партнер (avatar + username або "немає пари")
// ==========================
export async function buildPartnerBlock(guild: Guild, user: User) {
  const partnerId = await getMarriage(guild.id, user.id);
  const partnerX = 215;
  const partnerY = 1023;
  const maxTextWidth = 600;

  if (partnerId) {
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

    const fontPath = path.join(__dirname, "../../fonts/Montserrat-Bold.ttf");
    const avgCharWidth = 50 * 0.6;
    const maxChars = Math.floor(maxTextWidth / avgCharWidth);
    let partnerName = partnerUser.username;
    if (partnerName.length > maxChars) partnerName = partnerName.slice(0, maxChars - 3) + "...";

    const partnerNameSvg = `
      <svg width="${maxTextWidth}" height="150">
        <style>
          @font-face {
            font-family: "MontserratBold";
            src: url("file://${fontPath}") format("truetype");
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
          ${partnerName}
        </text>
      </svg>
    `;

    return [
      { input: partnerCircle, left: partnerX, top: partnerY },
      { input: Buffer.from(partnerNameSvg), left: partnerX + 125, top: partnerY }
    ];
  } else {
    const noPartnerSquare = await sharp({
      create: {
        width: 110,
        height: 110,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    }).composite([{
      input: Buffer.from(`
        <svg width="110" height="110">
          <rect x="0" y="0" width="110" height="110" rx="15" ry="15" fill="white"/>
        </svg>
      `),
      blend: "dest-in",
    }]).png().toBuffer();

    const fontPath = path.join(__dirname, "../../fonts/Montserrat-Bold.ttf");
    const noPartnerSvg = `
      <svg width="${maxTextWidth}" height="150">
        <style>
          @font-face {
            font-family: "MontserratBold";
            src: url("file://${fontPath}") format("truetype");
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

    return [
      { input: noPartnerSquare, left: partnerX, top: partnerY },
      { input: Buffer.from(noPartnerSvg), left: partnerX + 125, top: partnerY }
    ];
  }
}
