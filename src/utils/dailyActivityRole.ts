import { Guild, EmbedBuilder, TextChannel } from "discord.js";
import { getUserStats } from "../firebase/db";
import cron from "node-cron";

const DAILY_ACTIVITY_ROLE_ID = "1457671301912334388";
const REQUIRED_VOICE_MINUTES = 240;
const REQUIRED_MESSAGES = 150;
const ANNOUNCE_CHANNEL_ID = "1440122833689641043";

const awardedToday = new Set<string>();

function isEligible(stats: { voiceMinutes?: number; messages?: number }) {
  return (stats.voiceMinutes ?? 0) >= REQUIRED_VOICE_MINUTES || (stats.messages ?? 0) >= REQUIRED_MESSAGES;
}

export function startDailyActivityRoleWatcher(client: any, guildId: string) {
  if (!guildId) throw new Error("GUILD_ID не заданий для DailyActivityRoleWatcher");

  console.log("🟢 DailyActivityRoleWatcher запущений для guildId =", guildId);

  const runCheck = async () => {
    console.log("🔄 Перевірка активності користувачів (runCheck)");

    try {
      const guild: Guild = await client.guilds.fetch(guildId);
      const members = await guild.members.fetch();

      const announceChannel = guild.channels.cache.get(ANNOUNCE_CHANNEL_ID) as TextChannel;
      if (!announceChannel || !announceChannel.isTextBased()) {
        console.warn(`⚠️ Канал для оголошень не знайдено або не текстовий: ${ANNOUNCE_CHANNEL_ID}`);
      }

      for (const [, member] of members) {
        if (member.user.bot) continue;

        try {
          const stats = await getUserStats(member.guild.id, member.id, "day");
          const hasRole = member.roles.cache.has(DAILY_ACTIVITY_ROLE_ID);

          if (isEligible(stats)) {
            if (!hasRole && !awardedToday.has(member.id)) {
              await member.roles.add(DAILY_ACTIVITY_ROLE_ID);
              awardedToday.add(member.id);
              console.log(`✅ Роль Premium видана: ${member.user.tag}`);

              // 🔹 Відправка повідомлення в канал
              if (announceChannel?.isTextBased()) {
                const embed = new EmbedBuilder()
                  .setDescription(`Вітаємо ${member}!\nВам видана роль **Premium** за актив. \n\n Для огляду можете переглянути свої ролі на сервері в профілі.`)
                  .setColor("#000000")
                  .setThumbnail(member.user.displayAvatarURL({ size: 128 }))

                await announceChannel.send({ content: `${member}`, embeds: [embed] });
              }
            }
          } else if (hasRole) {
            await member.roles.remove(DAILY_ACTIVITY_ROLE_ID);
            console.log(`❌ Роль Premium знята: ${member.user.tag}`);
          }
        } catch (err) {
          console.error(`❌ Помилка для ${member.user.tag}:`, err);
        }
      }
    } catch (err) {
      console.error("❌ Помилка runCheck:", err);
    }
  };

  // 🔹 Перша перевірка одразу
  runCheck();

  // 🔹 Cron кожні 3 хв
  cron.schedule("*/3 * * * *", runCheck, { timezone: "Europe/Kyiv" });

  // 🔹 Cron для щоденного скидання кешу
  cron.schedule("0 0 * * *", () => {
    awardedToday.clear();
    console.log("♻️ Кеш ролей очищено на новий день (cron)");
  }, { timezone: "Europe/Kyiv" });
}
