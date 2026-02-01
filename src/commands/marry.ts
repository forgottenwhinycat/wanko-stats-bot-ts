import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";

import {
  getMarriage,
  setMarriage,
  divorceMarriage,
} from "../firebase/db";

export const marriageProposals = new Map<string, string>();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("marry")
    .setDescription("Система одруження")
    .addSubcommand(sub =>
      sub
        .setName("propose")
        .setDescription("Запропонувати одруження користувачу")
        .addUserOption(o =>
          o.setName("user").setDescription("Кому пропозиція?").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName("accept").setDescription("Прийняти пропозицію одруження")
    )
    .addSubcommand(sub =>
      sub.setName("decline").setDescription("Відхилити пропозицію одруження")
    )
    .addSubcommand(sub =>
      sub.setName("divorce").setDescription("Розлучитися з партнером")
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    // /marry propose
    if (sub === "propose") {
      const target = interaction.options.getUser("user", true);
      if (target.id === userId)
        return interaction.reply({ content: "❌ Ти не можеш одружитися сам із собою!", ephemeral: true });

      const current1 = await getMarriage(guildId, userId);
      const current2 = await getMarriage(guildId, target.id);
      if (current1) return interaction.reply(`❌ Ти вже одружений з <@${current1}>!`);
      if (current2) return interaction.reply(`❌ <@${target.id}> вже одружений з іншим!`);

      marriageProposals.set(target.id, userId);
      const embed = new EmbedBuilder()
        .setColor("#000000")
        .setTitle("💍 Пропозиція одруження")
        .setDescription(`**<@${target.id}>**, ти отримав(-ла) пропозицію від **<@${userId}>**!`)
        .addFields(
          { name: "Прийняти", value: "`/marry accept`" },
          { name: "Відхилити", value: "`/marry decline`" }
        );

        return interaction.reply({ 
        content: `**<@${target.id}>**`, 
        embeds: [embed] 
        });
    }

    // /marry accept
    if (sub === "accept") {
      const proposer = marriageProposals.get(userId);
      if (!proposer) return interaction.reply({ content: "У тебе немає активних пропозицій.", ephemeral: true });

      const married1 = await getMarriage(guildId, proposer);
      const married2 = await getMarriage(guildId, userId);
      if (married1 || married2) return interaction.reply({ content: "Хтось із вас уже одружений!", ephemeral: true });

      await setMarriage(guildId, proposer, userId);
      marriageProposals.delete(userId);

      return interaction.reply(`🎉 **<@${proposer}>** та **<@${userId}>** тепер одружені! 💖`);
    }

    // /marry decline
    if (sub === "decline") {
      const proposer = marriageProposals.get(userId);
      if (!proposer) return interaction.reply({ content: "У тебе немає пропозицій.", ephemeral: true });

      marriageProposals.delete(userId);
      return interaction.reply(`❌ Ти відхилив(-ла) пропозицію <@${proposer}>.`);
    }

    // /marry divorce
    if (sub === "divorce") {
      const current = await getMarriage(guildId, userId);
      if (!current) return interaction.reply({ content: "Ти не одружений.", ephemeral: true });

      await divorceMarriage(guildId, userId, current);
      return interaction.reply(`💔 Ви успішно розлучилися з <@${current}>.`);
    }
  },
};
