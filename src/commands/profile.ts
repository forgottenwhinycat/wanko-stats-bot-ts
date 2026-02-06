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
} from "../utils/commands/profile/profileUtils";
import { BannerLayout } from "../utils/commands/profile/profileConfig";
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

    const user: User = interaction.options.getUser("user") || interaction.user;

    const statsDay = await getUserStats(guild.id, user.id, "day");
    const statsAll = await getUserStats(guild.id, user.id, "all");
    const leaderboard = await getLeaderboard(guild.id, "all");
    const rank = leaderboard.findIndex((u) => u.userId === user.id) + 1;

    const avatarBuffer = await fetch(
      user.displayAvatarURL({ extension: "png", size: 512 })
    ).then((r) => r.arrayBuffer());

    const avatarCircle = await sharp(Buffer.from(avatarBuffer))
      .resize(BannerLayout.avatar.size, BannerLayout.avatar.size)
      .composite([
        {
          input: Buffer.from(`
            <svg width="${BannerLayout.avatar.size}" height="${BannerLayout.avatar.size}">
              <circle cx="${BannerLayout.avatar.size / 2}" cy="${BannerLayout.avatar.size / 2}" r="${BannerLayout.avatar.size / 2}" fill="white"/>
            </svg>
          `),
          blend: "dest-in",
        },
      ])
      .png()
      .toBuffer();

    const displayedUsername = fitUsername(
      user.username,
      BannerLayout.username.blockWidth,
      BannerLayout.username.fontSize
    );
    const usernameSvg = buildUsernameSvg(displayedUsername);

    const usernameX =
      BannerLayout.avatar.x +
      Math.round(BannerLayout.avatar.size / 2 - BannerLayout.username.blockWidth / 2);
    const usernameY =
      BannerLayout.avatar.y + BannerLayout.avatar.size + BannerLayout.username.offsetYFromAvatar;

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
        left: BannerLayout.grid.offsetX + col * (BannerLayout.grid.colWidth + BannerLayout.grid.colGap),
        top: BannerLayout.grid.offsetY + row * (BannerLayout.grid.rowHeight + BannerLayout.grid.rowGap),
      };
    });

    const partnerComposites = await buildPartnerBlock(guild, user);

    const result = await sharp(bannerPath)
      .composite([
        { input: avatarCircle, left: BannerLayout.avatar.x, top: BannerLayout.avatar.y },
        { input: Buffer.from(usernameSvg), left: usernameX, top: Math.round(usernameY) },
        ...gridComposites,
        ...partnerComposites,
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
