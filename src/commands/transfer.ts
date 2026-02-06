import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { spendBalance, addBalance, getUserStats } from "../firebase/db";

const COMMISSION_PERCENT = 10;
const COMMISSION_THRESHOLD = 150;

export const data = new SlashCommandBuilder()
  .setName("transfer")
  .setDescription("Передати монети іншому учаснику")
  .addUserOption(o =>
    o.setName("user").setDescription("Отримувач").setRequired(true)
  )
  .addIntegerOption(o =>
    o.setName("amount").setDescription("Сума").setRequired(true).setMinValue(1)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild;
  if (!guild) return void interaction.reply({ ephemeral: true, content: "❌ Команда доступна тільки на сервері" });

  const sender = interaction.user;
  const receiver = interaction.options.getUser("user", true);
  const amount = interaction.options.getInteger("amount", true);

  if (receiver.bot) return void interaction.reply({ ephemeral: true, content: "❌ Ботам не можна передавати монети" });
  if (receiver.id === sender.id) return void interaction.reply({ ephemeral: true, content: "❌ Не можна передавати монети самому собі" });

  await interaction.deferReply();

  const commission = amount >= COMMISSION_THRESHOLD ? Math.ceil((amount * COMMISSION_PERCENT) / 100) : 0;
  const receivedAmount = amount - commission;

  try {
    await spendBalance(guild.id, sender.id, amount);
    await addBalance(guild.id, receiver.id, receivedAmount);

    const senderStats = await getUserStats(guild.id, sender.id);
    const senderBalance = senderStats.balance ?? 0;

    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setAuthor({ name: "Переказ монет", iconURL: sender.displayAvatarURL({ size: 128 }) })
      .setThumbnail(sender.displayAvatarURL({ size: 1024 }))
      .addFields(
        { name: "Ви віддали", value: `\`\`\`${amount}\`\`\``, inline: true },
        { name: "Отримав", value: `\`\`\`${receivedAmount}\`\`\``, inline: true },
        { name: "Ваш баланс", value: `\`\`\`${senderBalance}\`\`\``, inline: true }
      )
      .setDescription(`**Отримувач:** <@${receiver.id}>${commission > 0 ? `\n**Комісія:** ${commission}` : ""}`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    if (err.message === "NOT_ENOUGH_BALANCE") return void interaction.editReply("❌ Недостатньо монет на балансі");
    if (err.message === "USER_STATS_NOT_FOUND") return void interaction.editReply("⚠️ Профіль користувача не знайдено");

    console.error("Transfer error:", err);
    await interaction.editReply("⚠️ Сталася помилка при переказі монет");
  }
}
