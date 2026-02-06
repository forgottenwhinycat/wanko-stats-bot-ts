import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { giveRep, getUserStats } from "../firebase/db";

const cooldowns = new Map<string, number>();

export const data = new SlashCommandBuilder()
  .setName("reputation")
  .setDescription("Зміна репутації учасника")
  .addUserOption(o => o.setName("user").setDescription("Користувач, якому даєте/забираєте репутацію").setRequired(true))
  .addStringOption(o =>
    o
      .setName("type")
      .setDescription("Додати або забрати репутацію")
      .setRequired(true)
      .addChoices(
        { name: "Додати +1", value: "add" },
        { name: "Відняти -1", value: "remove" }
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild;
  if (!guild) return void interaction.reply({ content: "Ця команда доступна лише на сервері.", ephemeral: true });

  const giverId = interaction.user.id;
  const targetUser = interaction.options.getUser("user", true);
  const type = interaction.options.getString("type", true);
  const amount = type === "add" ? 1 : -1;

  const now = Date.now();
  const cooldownTime = 6 * 60 * 60 * 1000;
  const expiration = cooldowns.get(giverId) || 0;
  if (now < expiration) {
    const remaining = expiration - now;
    const hours = Math.floor(remaining / 3_600_000);
    const minutes = Math.floor((remaining % 3_600_000) / 60_000);
    return void interaction.reply({ content: `Зачекай ще ${hours} годин і ${minutes} хвилин перед повторним використанням реп-команди.`, ephemeral: true });
  }

  cooldowns.set(giverId, now + cooldownTime);
  await interaction.deferReply();

  try {
    const result = await giveRep(guild.id, giverId, targetUser.id, amount);
    if (!result.success) return void interaction.editReply(result.message);

    const receiverStats = await getUserStats(guild.id, targetUser.id);
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setAuthor({ name: "Репутація", iconURL: interaction.user.displayAvatarURL({ size: 128 }) })
      .setThumbnail(targetUser.displayAvatarURL({ size: 1024 }))
      .addFields(
        { name: "Видано", value: `\`\`\`${amount > 0 ? "+" : ""}${amount}\`\`\``, inline: true },
        { name: "Репутація", value: `\`\`\`${receiverStats.rep}\`\`\``, inline: true }
      )
      .setDescription(`Видав: <@${interaction.user.id}>`) 
      .setTimestamp();


    await interaction.editReply({content: `<@${targetUser.id}>`, embeds: [embed] });
  } catch (err) {
    console.error("Rep command error:", err);
    await interaction.editReply("❌ Сталася помилка при зміні репутації.");
  }
}
