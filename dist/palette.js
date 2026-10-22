export const validColor = color => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color);

export function colorAt(hue) {
  hue = ((hue % 6) + 6) % 6;
  const x = 1 - Math.abs(hue % 2 - 1);
  return '#' + [[1,x,0],[x,1,0],[0,1,x],[0,x,1],[x,0,1],[1,0,x]][Math.floor(hue)]
    .map(channel => Math.round((.28 + .65 * channel) * 255).toString(16).padStart(2, '0')).join('');
}

export function makePalette(count, offset = Math.random() * 6, reserved = []) {
  const used = new Set(reserved.filter(validColor).map(color => color.toLowerCase()));
  if (!Number.isInteger(count) || count < 0 || count + used.size > 0x1000000) throw new RangeError('Invalid palette size');
  return Array.from({ length: count }, (_, index) => {
    let value = Number.parseInt(colorAt(offset + 6 * index / count).slice(1), 16), color;
    // Keep distinct hex colors even when a large palette rounds to the same RGB.
    do { color = `#${value.toString(16).padStart(6, '0')}`; value = (value + 0x010101) & 0xffffff; } while (used.has(color));
    used.add(color); return color;
  });
}

export function needsPaletteRepair(rows) {
  if (rows.some(row => !validColor(row.color))) return true;
  const automatic = rows.filter(row => !row.manualColor).map(row => row.color.toLowerCase());
  return new Set(automatic).size !== automatic.length;
}
