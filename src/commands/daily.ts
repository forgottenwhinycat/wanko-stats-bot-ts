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

  if (!result.success && result.remaining) {
    const { hours, minutes, seconds } = result.remaining;

    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setAuthor({
        name: "Нагорода недоступна",
        iconURL: interaction.user.displayAvatarURL({ size: 128 }),
      })
      .setThumbnail(interaction.user.displayAvatarURL({ size: 128 }))
      .addFields({
        name: "Доступно через",
        value: `\`\`\`${hours}ч ${minutes}хв ${seconds}с\`\`\``,
        inline: true,
      })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
    });
  }

    const stats = await getUserStats(guildId, userId);
    const balance = stats.balance ?? 0;

    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setAuthor({ name: "Щоденна нагорода", iconURL: interaction.user.displayAvatarURL({ size: 128 }) })
      .setThumbnail(interaction.user.displayAvatarURL({ size: 512 }))
      .addFields(
        { name: "Отримано монет", value: `\`\`\`${result.reward}\`\`\``, inline: true },
        { name: "Ваш баланс", value: `\`\`\`${balance}\`\`\``, inline: true }
      )
      .setDescription(`<@${userId}> отримав щоденну нагороду!`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (err) {
    console.error("Помилка при виконанні /daily:", err);
    await interaction.reply({
      content: "❌ Сталася помилка при отриманні щоденної нагороди.",
      ephemeral: true,
    });
  }
}
