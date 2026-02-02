import fs from "fs";
import path from "path";
import express from "express";
import cron from "node-cron";
import moment from "moment-timezone";

import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  Collection,
  Events,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  RESTGetAPIApplicationCommandsResult,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  TextChannel,
  GuildMember
} from "discord.js";

import { addXp, addVoiceXp, resetOldPeriods, giveVoicePassiveCoin } from "./src/firebase/db";

import config from "./config.json";

import { handleButton } from "./src/commands/reward";

import { initGuildVisuals } from "./src/utils/guildVisuals";

const token = config.DISCORD_TOKEN;
const clientId = config.CLIENT_ID;
const guildId = config.GUILD_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (_req, res) => res.send("Bot is running!"));
app.listen(PORT, () => console.log(`🌐 HTTP сервер запущено на порту ${PORT}`));

const commands = new Collection<string, any>();
const commandsPath = path.join(__dirname, "src", "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith(".ts") || f.endsWith(".js"));
const commandData: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];
for (const file of commandFiles) {
  const cmd = require(path.join(commandsPath, file));

  console.log("Loading command:", file, "-> keys:", Object.keys(cmd));

  if (!cmd.data || typeof cmd.data.name !== "string") {
    console.error(`❌ ERROR IN COMMAND FILE: ${file} — missing or invalid "data"`);
    continue;
  }

  commands.set(cmd.data.name, cmd);
  commandData.push(cmd.data.toJSON());
}

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(token);
  try {
    console.log("⏳ Реєструємо slash-команди...");
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commandData });
    console.log("✅ Команди зареєстровано!");
  } catch (err) {
    console.error("Помилка реєстрації:", err);
  }
}

async function clearCommands() {
  const rest = new REST({ version: "10" }).setToken(token);
  try {
    console.log("🧹 Очищуємо всі глобальні команди...");
    const globalCommands = (await rest.get(Routes.applicationCommands(clientId))) as RESTGetAPIApplicationCommandsResult;
    for (const cmd of globalCommands) {
      await rest.delete(Routes.applicationCommand(clientId, cmd.id));
      console.log(`Видалено глобальну команду: ${cmd.name}`);
    }
    console.log("✅ Всі slash-команди видалені!");
  } catch (err) {
    console.error("❌ Помилка при очищенні команд:", err);
  }
}

const CATEGORY_ID = "1440122833190781053"; 
const SUPPORT_ROLE_ID = "1440122830451769494";
const MOD_ROLE_ID = "1440122830451769494";
const ADMIN_ROLE_ID = "1440122830451769494";
const TICKET_PANEL_CHANNEL_ID = "1440122833190781057";

client.once("clientReady", async () => {
  console.log(`✅ Увійшов як ${client.user?.tag}`);

  initGuildVisuals(client, guildId);

  await clearCommands();
  await registerCommands();
  await resetOldPeriods();

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
      const nowKyiv = moment().tz("Europe/Kyiv").format("YYYY-MM-DD HH:mm:ss");
      console.log(`🕧 ${nowKyiv} — запуск resetOldPeriods()`);
      try {
        await resetOldPeriods();
        console.log("♻️ Статистику скинуто успішно!");
      } catch (err) {
        console.error("❌ Помилка при resetOldPeriods:", err);
      }
    },
    { timezone: "Europe/Kyiv" }
  );

  const channel = await client.channels.fetch(TICKET_PANEL_CHANNEL_ID);
  if (channel?.isTextBased()) {
    const textChannel = channel as TextChannel;
    const embed = new EmbedBuilder()
      .setTitle("📩 Панель тікетів")
      .setDescription("Виберіть тип заявки, яку ви хочете подати.")
      .setColor("#F4C7B4")
      .setThumbnail(client.user?.avatarURL() ?? null)
      .addFields(
        { name: "Підтримка", value: "Отримайте допомогу від нашої підтримки.", inline: true },
        { name: "Скарга", value: "Подайте скаргу для модерації та адміністрації.", inline: true }
      );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("create_support").setLabel("Підтримка").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("create_report").setLabel("Подати скаргу").setStyle(ButtonStyle.Danger)
    );

    await textChannel.send({ embeds: [embed], components: [row] });
  }

  console.log("🕐 Бот готовий і панель тикетів надіслана!");
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;
  await addXp(message.guild.id, message.author.id, message.content);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const ALLOWED_CHANNELS = ["1440122833689641043"];
    if (!ALLOWED_CHANNELS.includes(interaction.channelId)) {
      return interaction.reply({ content: "🚫 Цю команду можна використовувати лише у спеціальному каналі <#1440122833689641043>!", ephemeral: true });
    }

    const cmd = commands.get(interaction.commandName);
    if (!cmd) return;
    

    try {
      await cmd.execute(interaction);
    } catch (err) {
      console.error("❌ Помилка виконання команди:", err);
      const errorReply = { content: "⚠️ Помилка виконання команди.", ephemeral: true };
      if (interaction.replied || interaction.deferred) await interaction.followUp(errorReply);
      else await interaction.reply(errorReply);
    }
  }

  if (interaction.isButton()) {
    const guild = interaction.guild;
    if (!guild) return;
    const member = interaction.member as GuildMember;

    if (interaction.customId === "claim_voice_reward") {
      return handleButton(interaction);
    }

    if (interaction.customId === "create_support") {
      const channel = await guild.channels.create({
        name: `support-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: CATEGORY_ID,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: SUPPORT_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
        ]
      });
      const ticketChannel = channel as TextChannel;
      const embed = new EmbedBuilder()
        .setTitle("🟢 Тікет підтримки створено")
        .setDescription("Опишіть вашу проблему. Наші співробітники незабаром допоможуть вам.")
        .setColor("Green");
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("close_ticket").setLabel("Закрити тікет").setStyle(ButtonStyle.Danger)
      );
      await ticketChannel.send({ embeds: [embed], components: [row] });
      await interaction.reply({ content: `Тікет створено: ${channel}`, ephemeral: true });
    }

    if (interaction.customId === "create_report") {
      const channel = await guild.channels.create({
        name: `report-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: CATEGORY_ID,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: MOD_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: ADMIN_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
        ]
      });
      const ticketChannel = channel as TextChannel;
      const embed = new EmbedBuilder()
        .setTitle("🔴 Скарга створена")
        .setDescription("Опишіть ситуацію та надайте докази. Модератори та адміністратори оброблять ваш запит.")
        .setColor("Red");
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("close_ticket").setLabel("Закрити тікет").setStyle(ButtonStyle.Danger)
      );
      await ticketChannel.send({ embeds: [embed], components: [row] });
      await interaction.reply({ content: `Скарга створена: ${channel}`, ephemeral: true });
    }
    
    if (interaction.customId === "close_ticket") {
      if (member.roles.cache.has(SUPPORT_ROLE_ID) || member.roles.cache.has(MOD_ROLE_ID) || member.roles.cache.has(ADMIN_ROLE_ID)) {
        await interaction.reply({ content: "Тікет закривається...", ephemeral: true });
        await interaction.channel?.delete();
      } else {
        await interaction.reply({ content: "У вас немає прав для закриття цього тікету.", ephemeral: true });
      }
    }
    
  }
});

client.login(token);