import sharp from "sharp";

export const TopLayout = {
  width: 1500,
  height: 800,
  avatarSize: 120,
  avatarX: 170,
  startY: 185,
  rowHeight: 100,
  rowSpacing: 20,
  spacingDecrease: 4,
  nameX: 350,
  valueX: 1120,
  titleY: 135,
  titleFontSize: 60,
  nameFontSize: 36,
  valueFontSize: 36,
};

export function formatVoiceTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}h ${m.toString().padStart(2, "0")}m`;
}

export function getRowsY(length: number): number[] {
  const rowsY: number[] = [];
  const { startY, rowHeight, rowSpacing, spacingDecrease } = TopLayout;
  for (let i = 0; i < length; i++) {
    const extraSpacing = i * (rowSpacing - spacingDecrease * i);
    let y = startY + i * rowHeight + extraSpacing;
    if (i === 1) y -= 5;
    if (i >= 3) y += 10;
    if (i >= 4) y += 15;
    rowsY.push(y);
  }
  return rowsY;
}

export function buildTopSvg(
  category: string,
  top5: { name: string; value: string | number }[],
  rowsY: number[]
): string {
  const { width, height, titleY, titleFontSize, nameX, nameFontSize, valueX, valueFontSize, rowHeight } = TopLayout;
  let svg = `
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .title { fill: #fff; font-size: ${titleFontSize}px; font-weight: bold; text-anchor: middle; }
      .name { fill: #fff; font-size: ${nameFontSize}px; font-weight: bold; }
      .value { fill: #fff; font-size: ${valueFontSize}px; font-weight: bold; text-anchor: end; }
    </style>
    <text x="${width / 2}" y="${titleY}" class="title">
      ТОП 5 ${category === "voice_day" ? "DAILY VOICE" : category.toUpperCase()}
    </text>
  `;
  top5.forEach((u, i) => {
    const y = rowsY[i] + rowHeight / 2 + 12;
    svg += `
      <text x="${nameX}" y="${y}" class="name">${u.name}</text>
      <text x="${valueX}" y="${y}" class="value">${u.value}</text>
    `;
  });
  svg += `</svg>`;
  return svg;
}

export async function buildAvatarBuffers(top5: { avatar: string }[]): Promise<Buffer[]> {
  const { avatarSize } = TopLayout;
  return Promise.all(
    top5.map(async (u) => {
      const fetched = await fetch(u.avatar);
      const arrayBuffer = await fetched.arrayBuffer();
      return sharp(Buffer.from(arrayBuffer))
        .resize(avatarSize, avatarSize)
        .composite([
          {
            input: Buffer.from(`
              <svg width="${avatarSize}" height="${avatarSize}">
                <clipPath id="clip">
                  <circle cx="${avatarSize / 2}" cy="${avatarSize / 2}" r="${avatarSize / 2 - 2}"/>
                </clipPath>
                <image href="${u.avatar}" width="${avatarSize}" height="${avatarSize}" clip-path="url(#clip)" preserveAspectRatio="xMidYMid slice"/>
              </svg>
            `),
            blend: "dest-in",
          },
        ])
        .png()
        .toBuffer();
    })
  );
}
