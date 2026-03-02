import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";

import {
  exchangeCoinsToLotus,
  exchangeLotusToCoins,
  LOTUS_EXCHANGE_RATE,
} from "../firebase/db";

export const data = new SlashCommandBuilder()
  .setName("exchange")
  .setDescription("Обмін валют")
  .addStringOption((opt) =>
    opt
      .setName("type")
      .setDescription("Тип обміну")
      .setRequired(true)
      .addChoices(
        { name: "Монети → Лотуси", value: "coins_to_lotus" },
        { name: "Лотуси → Монети", value: "lotus_to_coins" },
      ),
  )
  .addIntegerOption((opt) =>
    opt
      .setName("amount")
      .setDescription("Кількість")
      .setRequired(true)
      .setMinValue(1),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;
  const avatar = interaction.user.displayAvatarURL({ size: 256 });

  const type = interaction.options.getString("type", true);
  const amount = interaction.options.getInteger("amount", true);

  try {
    let embed: EmbedBuilder;

    // =====================
    // 💰 Coins → Lotus
    // =====================
    if (type === "coins_to_lotus") {
      const result = await exchangeCoinsToLotus(guildId, userId, amount);

      embed = new EmbedBuilder()
        .setColor(0x0f0f0f)
        .setAuthor({
          name: "Обмін валют • Coins → Lotus",
          iconURL: avatar,
        })
        .setThumbnail(avatar)
        .addFields(
          {
            name: "👤 Користувач",
            value: `<@${userId}>`,
            inline: true,
          },
          {
            name: "💰 Витрачено",
            value: `${result.spent} монет`,
            inline: true,
          },
          {
            name: "🌸 Отримано",
            value: `${result.received} лотус(ів)`,
            inline: true,
          },
          {
            name: "📊 Результат обміну",
            value:
              "```ansi\n" +
              `Монети:  ${result.balance}\n` +
              `Лотуси:  ${result.lotus}\n` +
              "```",
          },
        );
    }

    // =====================
    // 🌸 Lotus → Coins
    // =====================
    else {
      const result = await exchangeLotusToCoins(guildId, userId, amount);

      embed = new EmbedBuilder()
        .setColor(0x0f0f0f)
        .setAuthor({
          name: "Обмін валют • Lotus → Coins",
          iconURL: avatar,
        })
        .setThumbnail(avatar)
        .addFields(
          {
            name: "👤 Користувач",
            value: `<@${userId}>`,
            inline: true,
          },
          {
            name: "🌸 Витрачено",
            value: `${result.spentLotus} лотус(ів)`,
            inline: true,
          },
          {
            name: "💰 Отримано",
            value: `${result.receivedCoins} монет`,
            inline: true,
          },
          {
            name: "📊 Результат обміну",
            value:
              "```ansi\n" +
              `Монети:  ${result.balance}\n` +
              `Лотуси:  ${result.lotus}\n` +
              "```",
          },
        );
    }

    embed
      .setFooter({
        text: `Курс: ${LOTUS_EXCHANGE_RATE} монет = 1 лотус`,
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (err: any) {
    let message = "Сталася помилка.";

    if (err.message === "NOT_ENOUGH_COINS") message = "❌ Недостатньо монет.";

    if (err.message === "NOT_ENOUGH_LOTUS") message = "❌ Недостатньо лотусів.";

    if (err.message === "INVALID_AMOUNT") message = "❌ Невірна кількість.";

    await interaction.reply({
      content: message,
      ephemeral: true,
    });
  }
}
