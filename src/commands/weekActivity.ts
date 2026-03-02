import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { getLeaderboard } from "../firebase/db";

const ITEMS_PER_PAGE = 5;

export const data = new SlashCommandBuilder()
  .setName("weekactivity")
  .setDescription("Показати топ активності за тиждень");

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const guildId = interaction.guildId!;
  const leaderboard = await getLeaderboard(guildId, "week");

  if (!leaderboard.length)
    return interaction.editReply("Немає даних активності за цей тиждень.");

  let page = 0;
  const totalPages = Math.ceil(leaderboard.length / ITEMS_PER_PAGE);

  const buildEmbed = async (page: number) => {
    const start = page * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const entries = leaderboard.slice(start, end);

    const embed = new EmbedBuilder()
      .setTitle("Топ активності за тиждень")
      .setColor("#2f3136")
      .setFooter({ text: `Сторінка ${page + 1} з ${totalPages}` });

    for (let i = 0; i < entries.length; i++) {
      const { userId, stats } = entries[i];
      let displayName = `<@${userId}>`;

      try {
        const member = await interaction.guild!.members.fetch(userId);
        displayName = member.displayName;
      } catch {}

      embed.addFields({
        name: `${start + i + 1}. ${displayName}`,
        value: `Повідомлень: ${stats.messages} | Голос: ${stats.voiceMinutes} хв`,
        inline: false,
      });
    }

    return embed;
  };

  const buildRow = (page: number) =>
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("prevPage")
        .setLabel("Назад")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId("nextPage")
        .setLabel("Вперед")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page + 1 >= totalPages),
    );

  const message = await interaction.editReply({
    embeds: [await buildEmbed(page)],
    components: [buildRow(page)],
  });

  const collector = message.createMessageComponentCollector({ time: 60_000 });

  collector.on("collect", async (btnInt) => {
    if (btnInt.user.id !== interaction.user.id)
      return btnInt.reply({ content: "Це не ваша сесія.", ephemeral: true });

    if (btnInt.customId === "prevPage") page--;
    if (btnInt.customId === "nextPage") page++;

    await btnInt.update({
      embeds: [await buildEmbed(page)],
      components: [buildRow(page)],
    });
  });

  collector.on("end", async () => {
    await interaction.editReply({ components: [] });
  });
}
