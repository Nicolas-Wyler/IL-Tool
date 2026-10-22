// All footprints are centered at the origin, so their common center is the
// maximum possible overlap. Normalize intensities by the sum of efficiencies.
export function fillCenterSquares(data, width, height, bounds, squares) {
  const intensity = new Float64Array(width * height);
  const valid = squares.filter(square => [square.width, square.azimuth, square.efficiency].every(Number.isFinite)
    && square.width > 0 && square.efficiency > 0 && square.efficiency <= 1);
  const maximum = valid.reduce((sum, square) => sum + square.efficiency, 0);
  if (maximum > 0 && Number.isFinite(bounds.width) && bounds.width > 0) {
    for (const square of valid) {
      const alpha = (square.azimuth % 360) * Math.PI / 180;
      const cos = Math.cos(alpha), sin = Math.sin(alpha), half = square.width / 2;
      const radius = half * (Math.abs(cos) + Math.abs(sin));
      const left = Math.max(0, Math.floor(((-radius - bounds.x) / bounds.width + .5) * width));
      const right = Math.min(width - 1, Math.ceil(((radius - bounds.x) / bounds.width + .5) * width));
      const top = Math.max(0, Math.floor((.5 - (radius - bounds.y) / bounds.width) * height));
      const bottom = Math.min(height - 1, Math.ceil((.5 - (-radius - bounds.y) / bounds.width) * height));
      for (let y = top; y <= bottom; y++) {
        const v = bounds.y + (.5 - (y + .5) / height) * bounds.width;
        for (let x = left; x <= right; x++) {
          const u = bounds.x + ((x + .5) / width - .5) * bounds.width;
          if (Math.abs(u * cos + v * sin) <= half && Math.abs(-u * sin + v * cos) <= half) {
            intensity[y * width + x] += square.efficiency;
          }
        }
      }
    }
  }
  for (let index = 0; index < intensity.length; index++) {
    const gray = maximum > 0 ? Math.round(255 * Math.min(1, intensity[index] / maximum)) : 0;
    data[index * 4] = data[index * 4 + 1] = data[index * 4 + 2] = gray;
    data[index * 4 + 3] = 255;
  }
}
