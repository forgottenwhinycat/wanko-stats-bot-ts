import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AttachmentBuilder,
  User,
} from "discord.js";

import path from "path";
import sharp from "sharp";

import {
  formatRank,
  formatVoiceTimeHMS,
  fitUsername,
  buildUsernameSvg,
  buildGridItemSvg,
  buildPartnerBlock,
} from "../utils/commands/profileUtils"

import { getUserStats, getLeaderboard } from "../firebase/db";

const bannerPath = path.join(__dirname, "../../images/profile.png");

export const data = new SlashCommandBuilder()
  .setName("profile")
  .setDescription("Показує красивий банер профілю користувача")
  .addUserOption((option) =>
    option
      .setName("user")
      .setDescription("Профіль якого користувача хочеш переглянути")
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const guild = interaction.guild;
    if (!guild) throw new Error("Guild not found");

    await interaction.deferReply();

    const user: User =
      interaction.options.getUser("user") || interaction.user;

    const statsDay = await getUserStats(guild.id, user.id, "day");
    const statsAll = await getUserStats(guild.id, user.id, "all");

    const leaderboard = await getLeaderboard(guild.id, "all");
    const rank = leaderboard.findIndex((u) => u.userId === user.id) + 1;

    const avatarBuffer = await fetch(
      user.displayAvatarURL({ extension: "png", size: 512 })
    ).then((r) => r.arrayBuffer());

    const avatarCircle = await sharp(Buffer.from(avatarBuffer))
      .resize(330, 330)
      .composite([
        {
          input: Buffer.from(`
            <svg width="330" height="330">
              <circle cx="165" cy="165" r="165" fill="white"/>
            </svg>
          `),
          blend: "dest-in",
        },
      ])
      .png()
      .toBuffer();

    const avatarX = 513;
    const avatarY = 297;
    const avatarSize = 330;

    const blockWidth = 800;
    const displayedUsername = fitUsername(user.username, blockWidth, 108);
    const usernameSvg = buildUsernameSvg(displayedUsername);

    const usernameX = avatarX + Math.round(avatarSize / 2 - blockWidth / 2);
    const usernameY = avatarY + avatarSize + 40;

    const gridOffsetX = 1560;
    const gridOffsetY = 230;
    const colGap = 300;
    const rowGap = 150;
    const colWidth = 250;
    const rowHeight = 105;

    const gridValues = [
      statsAll.rep,
      statsAll.balance,
      statsAll.messages,
      formatVoiceTimeHMS(statsDay.voiceMinutes),
      formatRank(rank),
      formatVoiceTimeHMS(statsAll.voiceMinutes),
    ];

    const gridComposites = gridValues.map((value, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);

      return {
        input: Buffer.from(buildGridItemSvg(value)),
        left: gridOffsetX + col * (colWidth + colGap),
        top: gridOffsetY + row * (rowHeight + rowGap),
      };
    });

    const partnerComposites = await buildPartnerBlock(guild, user);

    const result = await sharp(bannerPath)
      .composite([
        { input: avatarCircle, left: avatarX, top: avatarY },
        {
          input: Buffer.from(usernameSvg),
          left: usernameX,
          top: Math.round(usernameY),
        },
        ...gridComposites,
        ...partnerComposites,
      ])
      .png()
      .toBuffer();

    const attachment = new AttachmentBuilder(result, {
      name: "profile.png",
    });

    await interaction.editReply({ files: [attachment] });
  } catch (err) {
    console.error("Profile command error:", err);
    await interaction.editReply("⚠️ Помилка при створенні профілю!");
  }
}
