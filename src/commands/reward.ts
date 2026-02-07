import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";

import { claimVoiceReward, getUserStats } from "../firebase/db";


const VOICE_REWARD_COOLDOWN_HOURS = 12;
const VOICE_REWARD_COOLDOWN_MS =
  VOICE_REWARD_COOLDOWN_HOURS * 60 * 60 * 1000;


export const data = new SlashCommandBuilder()
  .setName("reward")
  .setDescription("Нагорода за 5 годин у голосовому чаті");

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    return interaction.reply({
      content: "Команда доступна лише на сервері.",
      ephemeral: true,
    });
  }

  const guildId = interaction.guildId!;
  const userId = interaction.user.id;
  const avatar = interaction.user.displayAvatarURL({ size: 512 });

  const result = await claimVoiceReward(guildId, userId);

  if (!result.success) {
    let value = "";

    if (result.reason === "COOLDOWN") {
      const ms = result.remainingMs ?? VOICE_REWARD_COOLDOWN_MS;

      const hours = Math.floor(ms / 3_600_000);
      const minutes = Math.floor((ms % 3_600_000) / 60_000);
      const seconds = Math.floor((ms % 60_000) / 1000);

      value = `${hours}год ${minutes}хв ${seconds}с`;
    }

    if (result.reason === "NOT_ENOUGH_MINUTES") {
      value = `${result.remaining} хв`;
    }

    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setAuthor({
        name: "Нагорода недоступна",
        iconURL: interaction.user.displayAvatarURL({ size: 128 }),
      })
      .setThumbnail(avatar)
      .addFields({
        name: "Доступно через",
        value: `\`\`\`${value}\`\`\``,
        inline: true,
      })
      .setTimestamp();

    return interaction.reply({ embeds: [embed]});
  }


  const stats = await getUserStats(guildId, userId);
  const balance = stats?.balance ?? 0;

  const embed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setAuthor({
      name: "Нагорода отримана",
      iconURL: interaction.user.displayAvatarURL({ size: 128 }),
    })
    .setThumbnail(avatar)
    .addFields(
      {
        name: "Отримано монет",
        value: `\`\`\`${result.reward}\`\`\``,
        inline: true,
      },
      {
        name: "Ваш баланс",
        value: `\`\`\`${balance}\`\`\``,
        inline: true,
      }
    )
    .setDescription(`<@${userId}> отримав нагороду за голосовий час`)
    .setTimestamp();

  return interaction.reply({ embeds: [embed]});
}
