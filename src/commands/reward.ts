import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";

import { claimVoiceReward } from "../firebase/db";

export const data = new SlashCommandBuilder()
  .setName("reward")
  .setDescription("Отримати 150 монет за 5 годин у голосовому.");

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild)
    return interaction.reply({
      content: "Команда доступна лише на сервері.",
      ephemeral: true,
    });

  const embed = new EmbedBuilder()
    .setTitle("🎁 Нагорода за голосовий час")
    .setDescription(
      "Натисніть кнопку нижче, щоб забрати свою нагороду за **5 годин у голосовому чаті**."
    )
    .setColor("#00C896");

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("claim_voice_reward")
      .setLabel("🎁 Забрати винагороду")
      .setStyle(ButtonStyle.Success)
  );

  return interaction.reply({ embeds: [embed], components: [row], ephemeral: false });
}

export async function handleButton(interaction: ButtonInteraction) {
  if (interaction.customId !== "claim_voice_reward") return;

  const result = await claimVoiceReward(interaction.guildId!, interaction.user.id);

  if (!result.success) {
    if (result.reason === "COOLDOWN") {
      const ms = result.remainingMs;
      const hours = Math.floor(ms / 3_600_000);
      const minutes = Math.floor((ms % 3_600_000) / 60_000);
      const seconds = Math.floor((ms % 60_000) / 1000);

      const embed = new EmbedBuilder()
        .setTitle("⏳ Занадто рано!")
        .setDescription(
          `Ви вже отримували нагороду нещодавно.\n\nСпробуйте через **${hours}год ${minutes}хв ${seconds}с**.`
        )
        .setColor("#ffcc00");

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (result.reason === "NOT_ENOUGH_MINUTES") {
      const embed = new EmbedBuilder()
        .setTitle("❌ Недостатньо часу у голосовому!")
        .setDescription(
          `Ви провели: **${result.minutes} хв**\n` +
          `Потрібно: **${result.required} хв**\n` +
          `Залишилось: **${result.remaining} хв**`
        )
        .setColor("#ff4444");

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  const embed = new EmbedBuilder()
    .setTitle("🎉 Винагорода отримана!")
    .setDescription(
      `Ви отримали **${result.reward} монет**!\n` +
      `Ваш новий баланс: **${result.newBalance} монет**`
    )
    .setColor("#00ff9d");

  return interaction.reply({ embeds: [embed], ephemeral: true });
}
