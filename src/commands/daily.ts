import { SlashCommandBuilder } from "discord.js";
import { claimDaily } from "../firebase/db"; // імпорт твоєї функції

export const data = new SlashCommandBuilder()
  .setName("daily")
  .setDescription("Отримати щоденну нагороду кожну годину");

export async function execute(interaction: any) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  try {
    const result = await claimDaily(guildId, userId);

    if (!result.success && result.remaining) {
      const { hours, minutes, seconds } = result.remaining;
      return interaction.reply({
        content: `⏳ Ще зарано! Наступна нагорода буде через ${hours}ч ${minutes}хв ${seconds}с.`,
        ephemeral: true,
      });
    }

    return interaction.reply({
      content: `💰 Ви отримали **${result.reward}** монет! Наступна нагорода буде через 1 годину.`,
      ephemeral: false,
    });
  } catch (error) {
    console.error("Помилка при виконанні /daily:", error);
    return interaction.reply({
      content: "❌ Сталася помилка при отриманні щоденної нагороди.",
      ephemeral: true,
    });
  }
}
