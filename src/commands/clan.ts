import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ColorResolvable
} from "discord.js";

import {
  createClan,
  requestJoinClan,
  acceptToClan,
  leaveClan,
  deleteClan,
  getUserClan,
  ownerKickMember,
  ownerCancelRequest
} from "../firebase/db";

// ------------------------ UTILS ------------------------

/** Створення Embed */
const makeEmbed = (title: string, description: string, color: ColorResolvable) =>
  new EmbedBuilder().setTitle(title).setDescription(description).setColor(color);

/** Відповідь з помилкою */
const errorReply = (interaction: ChatInputCommandInteraction, msg: string) =>
  interaction.reply({ content: msg, ephemeral: true });

/** Перевірка, що користувач — власник клану */
const ensureOwner = async (interaction: ChatInputCommandInteraction, guildId: string, userId: string) => {
  const clan = await getUserClan(guildId, userId);
  if (!clan) {
    await errorReply(interaction, "Ви не є власником жодного клану.");
    return null;
  }
  return clan;
};

// --------------------------------------------------------

module.exports = {
  data: new SlashCommandBuilder()
    .setName("clan")
    .setDescription("Кланова система")
    .addSubcommand(sub =>
      sub
        .setName("create")
        .setDescription("Створити клан")
        .addStringOption(o =>
          o.setName("name").setDescription("Назва клану (також буде ID)").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("join")
        .setDescription("Подати заявку на вступ")
        .addStringOption(o =>
          o.setName("name").setDescription("Назва клану").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("accept")
        .setDescription("Прийняти учасника в клан")
        .addUserOption(o =>
          o.setName("user").setDescription("Кого прийняти").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName("leave").setDescription("Покинути клан")
    )
    .addSubcommand(sub =>
      sub.setName("delete").setDescription("Видалити клан (лише власник)")
    )
    .addSubcommand(sub =>
      sub
        .setName("kick")
        .setDescription("Вигнати учасника з клану (лише власник)")
        .addUserOption(o =>
          o.setName("user").setDescription("Кого кікнути").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("cancel")
        .setDescription("Скасувати заявку користувача на вступ")
        .addUserOption(o =>
          o.setName("user").setDescription("Чию заявку скасувати").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("info")
        .setDescription("Дізнатися клан користувача")
        .addUserOption(o =>
          o.setName("user").setDescription("Користувач (необов'язково)").setRequired(false)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    const userId = interaction.user.id;
    const sub = interaction.options.getSubcommand();

    try {
      switch (sub) {
        // CREATE
        case "create": {
          const name = interaction.options.getString("name", true);
          await createClan(guildId, name, userId, name);

          return interaction.reply({
            embeds: [makeEmbed("🏰 Клан створено", `Ви успішно створили клан **${name}**`, "#00ADEF")]
          });
        }

        // JOIN
        case "join": {
          const name = interaction.options.getString("name", true);
          await requestJoinClan(guildId, name, userId);

          return interaction.reply({
            embeds: [
              makeEmbed(
                "📩 Заявка на вступ",
                `<@${userId}> подав заявку на вступ до клану **${name}**`,
                "#FFD700"
              )
            ],
            ephemeral: false
          });
        }

        // ACCEPT
        case "accept": {
          const target = interaction.options.getUser("user", true);
          const clan = await ensureOwner(interaction, guildId, userId);
          if (!clan) return;

          await acceptToClan(guildId, clan, userId, target.id);

          return interaction.reply({
            embeds: [
              makeEmbed("✅ Учасник прийнятий", `<@${target.id}> тепер член клану **${clan}**`, "#00FF00")
            ]
          });
        }

        // KICK
        case "kick": {
          const target = interaction.options.getUser("user", true);
          const clan = await ensureOwner(interaction, guildId, userId);
          if (!clan) return;

          await ownerKickMember(guildId, clan, userId, target.id);

          return interaction.reply({
            embeds: [
              makeEmbed("❌ Учасник вигнаний", `<@${target.id}> був вигнаний з клану **${clan}**`, "#FF0000")
            ]
          });
        }

        // CANCEL
        case "cancel": {
          const target = interaction.options.getUser("user", true);
          const clan = await ensureOwner(interaction, guildId, userId);
          if (!clan) return;

          await ownerCancelRequest(guildId, clan, userId, target.id);

          return interaction.reply({
            embeds: [
              makeEmbed(
                "🛑 Заявка скасована",
                `Заявка <@${target.id}> на вступ до клану **${clan}** скасована`,
                "#FFA500"
              )
            ]
          });
        }

        // LEAVE
        case "leave": {
          const clan = await getUserClan(guildId, userId);
          if (!clan) return errorReply(interaction, "Ви не перебуваєте у жодному клані.");

          await leaveClan(guildId, clan, userId);

          return interaction.reply({
            embeds: [makeEmbed("🏃‍♂️ Покинув клан", `Ви покинули клан **${clan}**`, "#FFA500")]
          });
        }

        // DELETE
        case "delete": {
          const clan = await ensureOwner(interaction, guildId, userId);
          if (!clan) return;

          await deleteClan(guildId, clan, userId);

          return interaction.reply({
            embeds: [makeEmbed("🗑️ Клан видалено", `Клан **${clan}** був видалений`, "#FF0000")]
          });
        }

        // INFO
        case "info": {
          const target = interaction.options.getUser("user") || interaction.user;
          const clan = await getUserClan(guildId, target.id);

          if (!clan)
            return errorReply(interaction, `${target.username} не перебуває у клані.`);

          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle("🏰 Клан користувача")
                .addFields(
                  { name: "Користувач", value: `<@${target.id}>`, inline: true },
                  { name: "Клан", value: clan, inline: true }
                )
                .setColor("#00ADEF")
            ]
          });
        }
      }
    } catch (err: any) {
      console.error(err);
      return errorReply(interaction, "⚠️ Сталася помилка: " + err.message);
    }
  }
};
