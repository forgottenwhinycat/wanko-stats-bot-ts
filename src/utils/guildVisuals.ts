import { Client, Guild, VoiceState } from "discord.js";
import sharp from "sharp";
import path from "path";

const ASSETS_DIR = path.join(__dirname, "..", "..", "assets");
const BANNER_PATH = path.join(ASSETS_DIR, "banner_base.png");
const FONT_PATH = path.join(__dirname, "../fonts/Montserrat-Bold.ttf"); 

const BANNER_WIDTH = 1920;
const BANNER_HEIGHT = 1080;

const TEXT_BLOCKS = {
  members: {
    x: 142,  
    y: 795,
    width: 300,
    height: 240,
    fontSize: 200,
  },
  voice: {
    x: 1483, 
    y: 795,
    width: 300,
    height: 240,
    fontSize: 200,
  },
};


let lastState: {
  membersInVoice: number | null;
  totalMembers: number | null;
} = {
  membersInVoice: null,
  totalMembers: null,
};

let updateTimeout: NodeJS.Timeout | null = null;


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
    block: typeof TEXT_BLOCKS.members
  ) => {
    const cx = block.x + block.width / 2;
    const cy = block.y + block.height / 2;

    return `
      <rect
        x="${block.x}"
        y="${block.y}"
        width="${block.width}"
        height="${block.height}"
        fill="rgba(0,0,0,0)"
      />
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
    @font-face {
      font-family: "MontserratBold";
      src: url("file://${FONT_PATH}") format("truetype");
      font-weight: 700;
      font-style: normal;
    }
    .text {
      fill: white;
      font-family: "MontserratBold";
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

export function initGuildVisuals(client: Client, guildId: string) {
  client.on("voiceStateUpdate", (oldState) => {
    const guild = oldState.guild;
    if (updateTimeout) clearTimeout(updateTimeout);
    updateTimeout = setTimeout(() => updateBanner(guild), 5000);
  });

  return async () => {
    const guild = await client.guilds.fetch(guildId);
    console.log("🎨 Банерна система активована для:", guild.name);
    await updateBanner(guild);
  };
}
