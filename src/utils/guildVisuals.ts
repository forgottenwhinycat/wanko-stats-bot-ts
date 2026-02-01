import { Client, Guild, VoiceState } from "discord.js";
import sharp from "sharp";
import path from "path";

/* ===================== CONFIG ===================== */

const ASSETS_DIR = path.join(__dirname, "..", "..", "assets");
const BANNER_PATH = path.join(ASSETS_DIR, "banner_base.png");

const BANNER_WIDTH = 1920;
const BANNER_HEIGHT = 1080;

/* === BLOCK CONFIG (YOU CONTROL POSITION HERE) === */

const TEXT_BLOCKS = {
  voice: {
    x: 142,        // X блоку
    y: 795,        // Y блоку
    width: 300,    // ФІКСОВАНА ширина
    height: 240,
    fontSize: 180,
  },
  members: {
    x: 1483,
    y: 795,
    width: 300,
    height: 240,
    fontSize: 180,
  },
};

/* ===================== STATE ===================== */

let lastState: {
  membersInVoice: number | null;
  totalMembers: number | null;
} = {
  membersInVoice: null,
  totalMembers: null,
};

let updateTimeout: NodeJS.Timeout | null = null;

/* ===================== BANNER ===================== */

async function updateBanner(guild: Guild): Promise<void> {
  const membersInVoice = guild.voiceStates.cache.filter(
    (vs: VoiceState) => vs.channelId
  ).size;

  const totalMembers = guild.memberCount;

  if (
    membersInVoice === lastState.membersInVoice &&
    totalMembers === lastState.totalMembers
  ) {
    return;
  }

  lastState = {
    membersInVoice,
    totalMembers,
  };

  const makeBlock = (
    value: number,
    block: typeof TEXT_BLOCKS.voice
  ) => {
    const cx = block.x + block.width / 2;
    const cy = block.y + block.height / 2;

    return `
      <!-- invisible block -->
      <rect
        x="${block.x}"
        y="${block.y}"
        width="${block.width}"
        height="${block.height}"
        fill="rgba(0,0,0,0)"
      />

      <!-- centered text -->
      <text
        x="${cx}"
        y="${cy}"
        font-size="${block.fontSize}"
        text-anchor="middle"
        dominant-baseline="middle"
        class="text"
      >
        ${value}
      </text>
    `;
  };

  const svgText = `
<svg width="${BANNER_WIDTH}" height="${BANNER_HEIGHT}">
  <style>
    .text {
      fill: white;
      font-family: sans-serif;
      font-weight: 700;
    }
  </style>
  ${makeBlock(totalMembers, TEXT_BLOCKS.members)}
  
  ${makeBlock(membersInVoice, TEXT_BLOCKS.voice)}
</svg>
`;

  try {
    const bannerBuffer = await sharp(BANNER_PATH)
      .resize(BANNER_WIDTH, BANNER_HEIGHT)
      .composite([{ input: Buffer.from(svgText), top: 0, left: 0 }])
      .jpeg({ quality: 85 })
      .toBuffer();

    await guild.setBanner(bannerBuffer);
    console.log(
      `🖼️ Банер оновлено | voice: ${membersInVoice}, members: ${totalMembers}`
    );
  } catch (error) {
    console.error("❌ Помилка при оновленні банеру:", error);
  }
}

/* ===================== INIT ===================== */

export function initGuildVisuals(client: Client, guildId: string) {
  client.once("clientReady", async () => {
    const guild = await client.guilds.fetch(guildId);
    console.log("🎨 Банерна система активована для:", guild.name);

    await updateBanner(guild);
  });

  client.on("voiceStateUpdate", (oldState) => {
    const guild = oldState.guild;

    if (updateTimeout) clearTimeout(updateTimeout);
    updateTimeout = setTimeout(() => {
      updateBanner(guild);
    }, 5000);
  });
}
