import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ButtonInteraction,
} from "discord.js";
import { getUserStats, deductLotus } from "../firebase/db";

// Настройки товаров
const lotusItems = [
  { id: "role_7d", name: "Роль на 7 днів", price: 50 },
  { id: "role_14d", name: "Роль на 14 днів", price: 100 },
  { id: "role_28d", name: "Роль на 28 днів", price: 200 },
  { id: "nitro_basic", name: "Discord Nitro (звичайне)", price: 200 },
  { id: "nitro_full", name: "Discord Nitro (повне)", price: 400 },
];

export const data = new SlashCommandBuilder()
  .setName("market")
  .setDescription("Магазин лотусів: купуйте ролі чи Discord Nitro");

export async function execute(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild;
  if (!guild)
    return interaction.reply({
      content: "Ця команда доступна лише на сервері.",
      ephemeral: true,
    });

  const userId = interaction.user.id;

  const createEmbed = async () => {
    const stats = await getUserStats(guild.id, userId);
    const balance = stats.lotus ?? 0;

    const itemsText = lotusItems
      .map((i) => `\`\`\` ${i.name} — ${i.price} лотусів\`\`\``)
      .join("\n");

    return new EmbedBuilder()
      .setTitle("🛒 Магазин лотусів")
      .setColor("#2f3136")
      .setDescription(itemsText)
      .setFooter({ text: `Ваш баланс: ${balance} 🌸` });
  };

  const createButtons = () => {
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    const chunkSize = 3; // скільки кнопок на рядок

    for (let i = 0; i < lotusItems.length; i += chunkSize) {
      const chunk = lotusItems.slice(i, i + chunkSize);
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        chunk.map((item) =>
          new ButtonBuilder()
            .setCustomId(`buy_${item.id}`)
            .setLabel(`${item.name} — ${item.price} 🌸`)
            .setStyle(ButtonStyle.Primary),
        ),
      );
      rows.push(row);
    }

    return rows;
  };

  await interaction.reply({
    embeds: [await createEmbed()],
    components: createButtons(),
    ephemeral: false,
  });

  // Коллектор для кнопок
  const collector = interaction.channel?.createMessageComponentCollector({
    filter: (i) => i.user.id === userId,
    time: 180_000,
  });

  collector?.on("collect", async (i: ButtonInteraction) => {
    if (!i.isButton()) return;

    const itemId = i.customId.replace("buy_", "");
    const item = lotusItems.find((it) => it.id === itemId);
    if (!item)
      return i.reply({ content: "Товар не знайдено.", ephemeral: true });

    try {
      const stats = await getUserStats(guild.id, userId);
      const lotusBalance = stats.lotus ?? 0;

      if (lotusBalance < item.price)
        return i.reply({
          content: `❌ Недостатньо лотусів. Потрібно ${item.price}, у вас ${lotusBalance}.`,
          ephemeral: true,
        });

      // Снимаем лотусы
      await deductLotus(guild.id, userId, item.price);

      // Отправляем отдельный эмбед с информацией о покупке
      const purchaseEmbed = new EmbedBuilder()
        .setTitle("🛒 Покупка завершена!")
        .setColor("#2f3136")
        .setThumbnail(i.user.displayAvatarURL({ size: 512 })) // аватарка справа
        .addFields({
          name: "Ваш товар",
          value: `\`\`\`\n${item.name} — ${item.price} 🌸\n\`\`\``,
          inline: false,
        })
        .setFooter({ text: `Покупець: ${i.user.tag}` })
        .setTimestamp();

      await i.reply({ embeds: [purchaseEmbed], ephemeral: false });

      // Обновляем основной embed магазина
      await interaction.editReply({ embeds: [await createEmbed()] });
    } catch (err) {
      console.error(err);
      if (!i.replied)
        await i.reply({
          content: "❌ Сталася помилка при купівлі.",
          ephemeral: true,
        });
    }
  });

  collector?.on("end", async () => {
    try {
      await interaction.editReply({ components: [] });
    } catch {}
  });
}
