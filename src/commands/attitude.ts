import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { giveRep } from "../firebase/db";

// Map для зберігання часу останнього використання команди користувачами
const cooldowns = new Map<string, number>();

export const data = new SlashCommandBuilder()
  .setName("reputation")
  .setDescription("Дай або забери реп у іншого користувача")
  .addUserOption(option =>
    option
      .setName("user")
      .setDescription("Користувач, якому даєте/забираєте реп")
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName("type")
      .setDescription("Додати або забрати реп")
      .setRequired(true)
      .addChoices(
        { name: "Додати +1", value: "add" },
        { name: "Відняти -1", value: "remove" }
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild;
  if (!guild) {
    return interaction.reply({
      content: "Ця команда доступна лише на сервері.",
      ephemeral: true,
    });
  }

  const userId = interaction.user.id;

  // Перевірка кд
  const now = Date.now();
  const cooldownAmount = 6 * 60 * 60 * 1000; // 6 годин в мс
  const expirationTime = cooldowns.get(userId) || 0;

  if (now < expirationTime) {
    const remaining = expirationTime - now;
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    return interaction.reply({
      content: `⏳ Зачекай ще ${hours} годин і ${minutes} хвилин перед повторним використанням реп-команди.`,
      ephemeral: true,
    });
  }

  // Оновлюємо кд
  cooldowns.set(userId, now + cooldownAmount);

  const targetUser = interaction.options.getUser("user", true);
  const type = interaction.options.getString("type", true);
  const amount = type === "add" ? 1 : -1;

  try {
    const result = await giveRep(guild.id, userId, targetUser.id, amount);
    const targetTag = `<@${targetUser.id}>`;

    return interaction.reply({
      content: `${targetTag} ${result.message}`,
      ephemeral: result.ephemeral ?? false,
    });
  } catch (err) {
    console.error("Rep command error:", err);
    return interaction.reply({
      content: "❌ Сталася помилка при зміні репутації.",
      ephemeral: true,
    });
  }
}
