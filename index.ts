import fs from "fs";
import path from "path";
import express from "express";
import cron from "node-cron";
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  Collection,
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  TextChannel,
  GuildMember,
} from "discord.js";
import {
  addXp,
  addVoiceXp,
  resetOldPeriods,
  giveVoicePassiveCoin,
} from "./src/firebase/db";
import config from "./config.json";
import { initGuildVisuals } from "./src/utils/guildVisuals";
import { startDailyActivityRoleWatcher } from "./src/utils/dailyActivityRole";

const { DISCORD_TOKEN: token, CLIENT_ID: clientId, GUILD_ID: guildId } = config;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
});

const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (_req, res) => res.send("Bot is running!"));
app.listen(PORT, () => console.log(`🌐 HTTP сервер запущено на порту ${PORT}`));

const commands = new Collection<string, any>();
const commandsPath = path.join(__dirname, "src", "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((f) => f.endsWith(".ts") || f.endsWith(".js"));
const commandData: any[] = [];

for (const file of commandFiles) {
  const cmd = require(path.join(commandsPath, file));
  if (!cmd.data?.name) continue;
  commands.set(cmd.data.name, cmd);
  commandData.push(cmd.data.toJSON());
}

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(token);
  try {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commandData,
    });
  } catch (err) {
    console.error("Помилка реєстрації:", err);
  }
}

async function clearCommands() {
  const rest = new REST({ version: "10" }).setToken(token);
  try {
    const globalCommands = (await rest.get(
      Routes.applicationCommands(clientId),
    )) as any[];
    for (const cmd of globalCommands)
      await rest.delete(Routes.applicationCommand(clientId, cmd.id));
  } catch (err) {
    console.error("Помилка при очищенні команд:", err);
  }
}

const CATEGORY_ID = "1371939572803571722";
const SUPPORT_ROLE_ID = "1434096770484273223";
const MOD_ROLE_ID = "1434096770484273223";
const ADMIN_ROLE_ID = "1434096770484273223";
const TICKET_PANEL_CHANNEL_ID = "1430662426860322907";

function createTicketChannel(interaction: any, type: "support" | "report") {
  return interaction.guild?.channels.create({
    name: `${type}-${interaction.user.username}`,
    type: ChannelType.GuildText,
    parent: CATEGORY_ID,
    permissionOverwrites: [
      { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
        ],
      },
      ...(type === "support"
        ? [
            {
              id: SUPPORT_ROLE_ID,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
              ],
            },
          ]
        : [
            {
              id: MOD_ROLE_ID,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
              ],
            },
            {
              id: ADMIN_ROLE_ID,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
              ],
            },
          ]),
    ],
  });
}

client.once(Events.ClientReady, async () => {
  const startBanner = initGuildVisuals(client, guildId);
  await startBanner();

  await clearCommands();
  await registerCommands();
  await resetOldPeriods();
  startDailyActivityRoleWatcher(client, guildId);

  setInterval(async () => {
    for (const guild of client.guilds.cache.values()) {
      for (const member of guild.members.cache.values()) {
        if (!member.voice.channel || member.user.bot) continue;
        await addVoiceXp(guild.id, member.id, 1);
        await giveVoicePassiveCoin(guild.id, member.id);
      }
    }
  }, 60_000);

  cron.schedule(
    "0 0 * * *",
    async () => {
      try {
        await resetOldPeriods();
      } catch {}
    },
    { timezone: "Europe/Kyiv" },
  );

  const channel = (await client.channels.fetch(
    TICKET_PANEL_CHANNEL_ID,
  )) as TextChannel;
  if (channel) {
    const embed = new EmbedBuilder()
      .setTitle("📩 Панель тікетів")
      .setDescription("Виберіть тип заявки, яку ви хочете подати.")
      .setColor("#F4C7B4")
      .setThumbnail(client.user?.avatarURL() ?? null)
      .addFields(
        {
          name: "Підтримка",
          value: "Отримайте допомогу від нашої підтримки.",
          inline: true,
        },
        {
          name: "Скарга",
          value: "Подайте скаргу для модерації та адміністрації.",
          inline: true,
        },
      );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("create_support")
        .setLabel("Підтримка")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("create_report")
        .setLabel("Подати скаргу")
        .setStyle(ButtonStyle.Danger),
    );

    await channel.send({ embeds: [embed], components: [row] });
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;
  await addXp(message.guild.id, message.author.id, message.content);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const ALLOWED_CHANNELS = ["1430661455056998501"];
    if (!ALLOWED_CHANNELS.includes(interaction.channelId)) {
      return interaction.reply({
        content:
          "🚫 Цю команду можна використовувати лише у спеціальному каналі <#1430661455056998501>!",
        ephemeral: true,
      });
    }
    const cmd = commands.get(interaction.commandName);
    if (!cmd) return;
    try {
      await cmd.execute(interaction);
    } catch {
      const reply = {
        content: "⚠️ Помилка виконання команди.",
        ephemeral: true,
      };
      if (interaction.replied || interaction.deferred)
        await interaction.followUp(reply);
      else await interaction.reply(reply);
    }
  }

  if (!interaction.isButton()) return;

  const member = interaction.member as GuildMember;

  if (
    interaction.customId === "create_support" ||
    interaction.customId === "create_report"
  ) {
    const type =
      interaction.customId === "create_support" ? "support" : "report";
    const ticketChannel = (await createTicketChannel(
      interaction,
      type,
    )) as TextChannel;
    const embed = new EmbedBuilder()
      .setTitle(
        type === "support"
          ? "🟢 Тікет підтримки створено"
          : "🔴 Скарга створена",
      )
      .setDescription(
        type === "support"
          ? "Опишіть вашу проблему. Наші співробітники незабаром допоможуть вам."
          : "Опишіть ситуацію та надайте докази. Модератори та адміністратори оброблять ваш запит.",
      )
      .setColor(type === "support" ? "Green" : "Red");

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("close_ticket")
        .setLabel("Закрити тікет")
        .setStyle(ButtonStyle.Danger),
    );

    await ticketChannel.send({ embeds: [embed], components: [row] });
    await interaction.reply({
      content: `${type === "support" ? "Тікет" : "Скарга"} створено: ${ticketChannel}`,
      ephemeral: true,
    });
  }

  if (interaction.customId === "close_ticket") {
    if (
      member.roles.cache.has(SUPPORT_ROLE_ID) ||
      member.roles.cache.has(MOD_ROLE_ID) ||
      member.roles.cache.has(ADMIN_ROLE_ID)
    ) {
      await interaction.reply({
        content: "Тікет закривається...",
        ephemeral: true,
      });
      await interaction.channel?.delete();
    } else {
      await interaction.reply({
        content: "У вас немає прав для закриття цього тікету.",
        ephemeral: true,
      });
    }
  }
});

client.login(token);
