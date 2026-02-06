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

  const runCheck = async () => {
    try {
      const guild: Guild = await client.guilds.fetch(guildId);
      const members = await guild.members.fetch();
      const announceChannel = guild.channels.cache.get(ANNOUNCE_CHANNEL_ID) as TextChannel;

      for (const [, member] of members) {
        if (member.user.bot) continue;

        try {
          const stats = await getUserStats(member.guild.id, member.id, "day");
          const hasRole = member.roles.cache.has(DAILY_ACTIVITY_ROLE_ID);

          if (isEligible(stats)) {
            if (!hasRole && !awardedToday.has(member.id)) {
              await member.roles.add(DAILY_ACTIVITY_ROLE_ID);
              awardedToday.add(member.id);

              if (announceChannel?.isTextBased()) {
                const embed = new EmbedBuilder()
                  .setDescription(`Вітаємо ${member}!\nВам видана роль **Premium** за актив.\n\nДля огляду можете переглянути свої ролі на сервері в профілі.`)
                  .setColor("#000000")
                  .setThumbnail(member.user.displayAvatarURL({ size: 128 }));

                await announceChannel.send({ content: `${member}`, embeds: [embed] });
              }
            }
          } else if (hasRole) {
            await member.roles.remove(DAILY_ACTIVITY_ROLE_ID);
          }
        } catch (err) {
          console.error(`Помилка для ${member.user.tag}:`, err);
        }
      }
    } catch (err) {
      console.error("Помилка runCheck:", err);
    }
  };

  runCheck();
  cron.schedule("*/5 * * * *", runCheck, { timezone: "Europe/Kyiv" });
  cron.schedule("0 0 * * *", () => awardedToday.clear(), { timezone: "Europe/Kyiv" });
}
