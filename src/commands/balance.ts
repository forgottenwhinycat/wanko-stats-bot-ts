import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { getUserStats } from "../firebase/db";

export const data = new SlashCommandBuilder()
  .setName("balance")
  .setDescription("Показати ваш баланс та лотуси")
  .addUserOption((option) =>
    option
      .setName("користувач")
      .setDescription("Подивитись баланс іншого користувача")
      .setRequired(false),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const target = interaction.options.getUser("користувач") || interaction.user;

  const stats = await getUserStats(interaction.guildId!, target.id, "all");

  const balance = stats.balance ?? 0;
  const lotus = stats.lotus ?? 0;

  const embed = new EmbedBuilder()
    .setColor("#2b2d31")
    .setAuthor({
      name: `Баланс ${target.username}`,
      iconURL: target.displayAvatarURL(),
    })
    .setThumbnail(target.displayAvatarURL({ size: 512 }))
    .setDescription("Відображення вашого балансу на сервері")
    .addFields(
      {
        name: "Баланс",
        value: "```" + balance + "```",
        inline: true,
      },
      {
        name: "Лотуси",
        value: "```" + lotus + "```",
        inline: true,
      },
    )
    .setFooter({
      text: `Wanko`,
    })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
