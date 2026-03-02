import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ButtonInteraction,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("info")
  .setDescription("Інформація про економіку сервера");

export async function execute(interaction: ChatInputCommandInteraction) {
  const icon =
    interaction.guild?.iconURL() || interaction.user.displayAvatarURL();

  /* =========================
     PAGE 1 — ECONOMY INFO
  ========================= */
  const page1 = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setAuthor({
      name: "Інформація про економіку сервера",
      iconURL: icon,
    })
    .setThumbnail(interaction.guild?.iconURL({ size: 512 }) || null)
    .setDescription(
      "📌 **Як працює економіка сервера?**\n\n" +
        "На сервері використовується дві валюти:\n" +
        "💰 **Монети** — основна ігрова валюта\n" +
        "🌸 **Лотуси** — цінна валюта для особливих нагород\n\n" +
        "🎙 Активність у голосових каналах та 💬 повідомлення приносять винагороди.\n" +
        "За кожні **180 хвилин** або **100 повідомлень**:\n" +
        "```30 монет```\n\n" +
        "💱 Монети можна обмінювати на лотуси.\n\n" +
        "✨ Чим активніше ви на сервері — тим більше можливостей.",
    )
    .setFooter({ text: `Сервер: ${interaction.guild?.name}` })
    .setTimestamp();

  /* =========================
     PAGE 2 — HOW TO GET LOTUS
  ========================= */
  const page2 = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setAuthor({
      name: "Як отримати лотуси",
      iconURL: icon,
    })
    .setThumbnail(interaction.guild?.iconURL({ size: 512 }) || null)
    .setDescription(
      "🌸 **Способи отримання лотусів**\n\n" +
        "💱 **1. Обмін монет** — основний спосіб.\n\n" +
        "🎙 **2. Голосові канали** — отримуєте монети → обмінюєте.\n\n" +
        "🏆 **3. Щотижневий топ:**\n" +
        "1 місце — 100 🌸\n" +
        "2 місце — 75 🌸\n" +
        "3 місце — 50 🌸\n\n" +
        "🎉 **4. Івенти сервера** — конкурси та події.\n\n" +
        "✨ Активність = більше нагород.",
    )
    .setFooter({ text: `Сервер: ${interaction.guild?.name}` })
    .setTimestamp();

  /* =========================
     PAGE 3 — LOTUS VALUE
  ========================= */
  const page3 = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setAuthor({
      name: "Вартість та використання лотусів",
      iconURL: icon,
    })
    .setThumbnail(interaction.guild?.iconURL({ size: 512 }) || null)
    .setDescription(
      "🌸 **Інформація про лотуси**\n\n" +
        "1 лотус = **1 гривня (UAH)**.\n\n" +
        "💳 **Виведення коштів**\n" +
        "Мінімум — **250 лотусів**.\n\n" +
        "🛒 **Використання:**\n" +
        "• персональні ролі\n" +
        "• обмін у валюту сервера\n" +
        "• Discord Nitro\n" +
        "• виведення у реальні кошти\n\n" +
        "✨ Ви самі вирішуєте як використовувати нагороду.",
    )
    .setFooter({ text: `Сервер: ${interaction.guild?.name}` })
    .setTimestamp();

  /* =========================
     BUTTONS (TABS)
  ========================= */
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("info_page_1")
      .setLabel("Економіка")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("info_page_2")
      .setLabel("Як отримати 🌸")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("info_page_3")
      .setLabel("Вартість 🌸")
      .setStyle(ButtonStyle.Secondary),
  );

  const message = await interaction.reply({
    embeds: [page1],
    components: [row],
    fetchReply: true, // отримуємо реальний Message
  });

  /* =========================
     BUTTON COLLECTOR
  ========================= */
  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 5 * 60 * 1000, // 5 хвилин
  });

  collector.on("collect", async (i: ButtonInteraction) => {
    if (i.user.id !== interaction.user.id) {
      return i.reply({
        content: "Ці кнопки не для вас 🙂",
        flags: 64, // ephemeral
      });
    }

    if (i.customId === "info_page_1") await i.update({ embeds: [page1] });
    if (i.customId === "info_page_2") await i.update({ embeds: [page2] });
    if (i.customId === "info_page_3") await i.update({ embeds: [page3] });
  });
  collector.on("end", async () => {
    const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      row.components.map((btn) => ButtonBuilder.from(btn).setDisabled(true)),
    );

    await interaction.editReply({
      components: [disabledRow],
    });
  });
}
