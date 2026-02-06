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

const shopItems: ShopItem[] = [
  { roleId: "1457671301912334388", name: "Premium", price: 10000 },
];

export const data = new SlashCommandBuilder()
  .setName("market")
  .setDescription("Переглянь магазин ролей та купуй їх за монети");

export async function execute(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild;
  if (!guild) return interaction.reply({ content: "Ця команда доступна лише на сервері.", ephemeral: true });

  const userId = interaction.user.id;

  const createMarketEmbed = async () => {
    const stats = await getUserStats(guild.id, userId, "all");
    const balance = stats.balance;
    const combinedBlock = shopItems.map(i => `\`\`\`💎 ${i.name} — ${i.price} 💰\`\`\``).join("\n");

    return new EmbedBuilder()
      .setTitle("🛒 Магазин ролей")
      .addFields({ name: "\u200B", value: combinedBlock })
      .setColor("#2f3136")
      .setFooter({ text: `Ваш баланс: ${balance} монет` });
  };

  const createButtons = () => {
    const buttons = shopItems.map(i =>
      new ButtonBuilder()
        .setCustomId(`buy_${i.roleId}`)
        .setLabel(`${i.name} — ${i.price} 💰`)
        .setStyle(ButtonStyle.Primary)
    );
    return new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
  };

  await interaction.reply({ embeds: [await createMarketEmbed()], components: [createButtons()], ephemeral: false });

  const collector = interaction.channel?.createMessageComponentCollector({
    filter: i => i.user.id === userId,
    time: 180_000
  });

  collector?.on("collect", async (i: ButtonInteraction) => {
    if (!i.isButton()) return;

    const roleId = i.customId.replace("buy_", "");
    const item = shopItems.find(it => it.roleId === roleId);
    if (!item) return i.reply({ content: "Ця роль більше недоступна.", ephemeral: true });

    try {
      const member = await guild.members.fetch(userId);
      const stats = await getUserStats(guild.id, userId, "all");
      const currentBalance = stats.balance;

      if (member.roles.cache.has(roleId)) return i.reply({ content: "Ви вже маєте цю роль.", ephemeral: true });
      if (currentBalance < item.price) return i.reply({ content: `❌ Недостатньо монет. Потрібно ${item.price}, у вас ${currentBalance}.`, ephemeral: true });

      const role = guild.roles.cache.get(roleId);
      if (!role) return i.reply({ content: "Роль не знайдена на сервері.", ephemeral: true });

      await member.roles.add(role);
      await deductBalance(guild.id, userId, item.price);
      await i.update({ embeds: [await createMarketEmbed()], components: [createButtons()] });

    } catch (err) {
      console.error("Market button error:", err);
      if (!i.replied) await i.reply({ content: "❌ Сталася помилка при купівлі ролі.", ephemeral: true });
    }
  });

  collector?.on("end", async () => {
    try {
      await interaction.editReply({ components: [] });
    } catch {}
  });
}
