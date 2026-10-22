import { inPlaneWavevector, TAU } from './field.js';
import { gratingSquare } from './grating-geometry.js';

export function maskBounds(rows, wavelength, distance, width) {
  const extent = { minX: -width / 2, maxX: width / 2, minY: -width / 2, maxY: width / 2 };
  for (const row of rows) {
    const azimuth = row.gratingAzimuth;
    const angle = azimuth * Math.PI / 180;
    const half = width / 2 * (Math.abs(Math.cos(angle)) + Math.abs(Math.sin(angle)));
    const square = gratingSquare({ wavelengthNm: wavelength, pitchNm: row.pitch === '' && row.theta !== '' && Number(row.theta) === 0 ? Infinity : Number(row.pitch),
      workingDistanceUm: distance, widthUm: width, azimuthDeg: azimuth });
    const corners = [...(square?.corners ?? []), { x: -half, y: -half }, { x: half, y: half }];
    for (const point of corners) {
      if (![point.x, point.y].every(Number.isFinite)) continue;
      extent.minX = Math.min(extent.minX, point.x); extent.maxX = Math.max(extent.maxX, point.x);
      extent.minY = Math.min(extent.minY, point.y); extent.maxY = Math.max(extent.maxY, point.y);
    }
  }
  return extent;
}
export function maskWidth(bounds) {
  return Math.max(1, 1.1 * Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY));
}
export function centerIfFits(bounds, visibleWidth) {
  return bounds.maxX - bounds.minX <= visibleWidth && bounds.maxY - bounds.minY <= visibleWidth
    ? { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 } : null;
}
export function maskViewCenter(bounds, view) {
  const center = centerIfFits(bounds, view.width);
  if (center) return center;
  if (!(view.width > 0) || ![view.width, view.x, view.y, ...Object.values(bounds)].every(Number.isFinite)) return null;
  const limit = (position, low, high) => {
    const overlap = Math.min(view.width * .1, high - low);
    return Math.max(low - view.width / 2 + overlap, Math.min(high + view.width / 2 - overlap, position));
  };
  const x = limit(view.x, bounds.minX, bounds.maxX), y = limit(view.y, bounds.minY, bounds.maxY);
  return x !== view.x || y !== view.y ? { x, y } : null;
}
export function interferenceWidth(waves, wavelength) {
  const vectors = waves.filter(wave => wave.amplitude > 0 && [wave.theta, wave.azimuth].every(Number.isFinite)).map(inPlaneWavevector);
  let separation = 0, magnitude = 0;
  for (let i = 0; i < vectors.length; i++) {
    magnitude = Math.max(magnitude, Math.hypot(vectors[i].ku, vectors[i].kv));
    for (let j = 0; j < i; j++) separation = Math.max(separation, Math.hypot(vectors[i].ku - vectors[j].ku, vectors[i].kv - vectors[j].kv));
  }
  const threshold = TAU / wavelength * 1e-12;
  const frequency = separation > threshold ? separation : magnitude > threshold ? magnitude : TAU / wavelength;
  const width = 10 * TAU / frequency;
  return Number.isFinite(width) && width > 0 ? width : 200;
}
