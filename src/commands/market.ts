import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ButtonBuilder, 
  ButtonStyle, 
  ActionRowBuilder, 
  EmbedBuilder, 
  ButtonInteraction 
} from "discord.js";
import { getUserStats, deductBalance } from "../firebase/db";
import { ShopItem } from "../types/types";

// Приклад магазину
const shopItems: ShopItem[] = [
  { roleId: "1443046181566681088", name: "VIP", price: 1250 },
  { roleId: "1443046211971059826", name: "MVP", price: 2500 },
  { roleId: "1443046258225840149", name: "Elite", price: 5000 },
];

export const data = new SlashCommandBuilder()
  .setName("market")
  .setDescription("Переглянь магазин ролей та купуй їх за монети");

export async function execute(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild;
  if (!guild) return interaction.reply({ content: "Ця команда доступна лише на сервері.", ephemeral: true });

  const userId = interaction.user.id;

  // Функція для створення embed із актуальним балансом
async function createMarketEmbed() {
  const stats = await getUserStats(guild!.id, userId, "all");
  const balance = stats.balance;

  // Третій блок — кожна роль з ціною разом (широкий блок)
  const combinedBlock = shopItems
    .map(item => `\`\`\`💎 ${item.name} — ${item.price} 💰\`\`\``)
    .join('\n');

  return new EmbedBuilder()
    .setTitle("🛒 Магазин ролей")
    .addFields(
      { name: "\u200B", value: combinedBlock } // широка стрічка з назвою і ціною
    )
    .setColor("#2f3136")
    .setFooter({ text: `Ваш баланс: ${balance} монет` });
}




  // Створюємо кнопки
  function createButtons() {
    const buttons = shopItems.map(item =>
      new ButtonBuilder()
        .setCustomId(`buy_${item.roleId}`)
        .setLabel(`${item.name} — ${item.price} 💰`)
        .setStyle(ButtonStyle.Primary)
    );
    return new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
  }

  // Відправляємо початкове повідомлення
  await interaction.reply({ embeds: [await createMarketEmbed()], components: [createButtons()], ephemeral: false });

  const collector = interaction.channel?.createMessageComponentCollector({
    filter: i => i.user.id === userId,
    time: 180000 // 3 хвилини
  });

collector?.on("collect", async (i: ButtonInteraction) => {
  if (!i.isButton()) return;

  const roleId = i.customId.replace("buy_", "");
  const item = shopItems.find(item => item.roleId === roleId);
  if (!item) return i.reply({ content: "Ця роль більше недоступна.", ephemeral: true });

  try {
    const member = await guild!.members.fetch(userId);
    const stats = await getUserStats(guild!.id, userId, "all");
    const currentBalance = stats.balance;

    // Перевірка на наявну роль
    if (member.roles.cache.has(roleId)) {
      return i.reply({ content: "Ви вже маєте цю роль.", ephemeral: true });
    }

    if (currentBalance < item.price) {
      return i.reply({ content: `❌ Недостатньо монет. Потрібно ${item.price}, у вас ${currentBalance}.`, ephemeral: true });
    }

    const role = guild!.roles.cache.get(roleId);
    if (!role) return i.reply({ content: "Роль не знайдена на сервері.", ephemeral: true });

    // Додаємо роль та віднімаємо баланс
    await member.roles.add(role);
    await deductBalance(guild!.id, userId, item.price);

    // Оновлюємо головний embed із новим балансом
    await i.update({ embeds: [await createMarketEmbed()], components: [createButtons()] });
  } catch (err) {
    console.error("Market button error:", err);
    // Використовуємо i.reply тільки якщо відповідь ще не була відправлена
    if (!i.replied) await i.reply({ content: "❌ Сталася помилка при купівлі ролі.", ephemeral: true });
  }
});


  collector?.on("end", async () => {
    try {
      // Деактивуємо кнопки після завершення колектора
      const message = await interaction.fetchReply();
      await interaction.editReply({ components: [] });
    } catch {}
  });
}
