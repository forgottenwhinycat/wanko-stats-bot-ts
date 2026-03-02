import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { claimDaily, getUserStats } from "../firebase/db";

export const data = new SlashCommandBuilder()
  .setName("daily")
  .setDescription("Отримати щоденну нагороду кожну годину");

export async function execute(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  try {
    const result = await claimDaily(guildId, userId);

    // ❌ Кулдаун
    if (!result.success && result.reason === "COOLDOWN") {
      const { hours, minutes, seconds } = result.remaining;

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setAuthor({
          name: "Нагорода недоступна",
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setThumbnail(interaction.user.displayAvatarURL({ size: 512 }))
        .addFields({
          name: "Доступно через",
          value: `\`\`\`${hours}ч ${minutes}хв ${seconds}с\`\`\``,
        })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // ❌ Недостаточно активности
    if (!result.success && result.reason === "NOT_ENOUGH_ACTIVITY") {
      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setAuthor({
          name: "Недостатньо активності",
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setThumbnail(interaction.user.displayAvatarURL({ size: 512 }))
        .addFields(
          {
            name: "🎙 Голос",
            value: `\`\`\`${result.voiceMinutes}/${result.requiredVoice} хв\`\`\``,
            inline: true,
          },
          {
            name: "💬 Повідомлення",
            value: `\`\`\`${result.messages}/${result.requiredMessages}\`\`\``,
            inline: true,
          }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // ✅ Успех
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setAuthor({
        name: "Щоденна нагорода",
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setThumbnail(interaction.user.displayAvatarURL({ size: 512 }))
      .addFields(
        {
          name: "Отримано",
          value: `\`\`\`${result.reward} монет\`\`\``,
          inline: true,
        },
        {
          name: "Баланс",
          value: `\`\`\`${result.newBalance}\`\`\``,
          inline: true,
        }
      )
      .setDescription(`<@${userId}> отримав нагороду за активність!`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

  } catch (err) {
    console.error("Помилка /daily:", err);
    await interaction.reply({
      content: "❌ Сталася помилка.",
      ephemeral: true,
    });
  }
}
