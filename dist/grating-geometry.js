import { wrapDegrees } from './field.js';

// Wavelength and pitch share nm units; all returned coordinates are in µm.
export function gratingSquare({ wavelengthNm, pitchNm, workingDistanceUm, widthUm, azimuthDeg }) {
  if (![wavelengthNm, workingDistanceUm, widthUm, azimuthDeg].every(Number.isFinite)
      || !(Number.isFinite(pitchNm) || pitchNm === Infinity)
      || wavelengthNm <= 0 || pitchNm <= wavelengthNm || workingDistanceUm < 0 || widthUm <= 0) return null;
  const ratio = wavelengthNm / pitchNm;
  const r = workingDistanceUm * (ratio / Math.sqrt((1 - ratio) * (1 + ratio)));
  const angle = wrapDegrees(azimuthDeg) * Math.PI / 180;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const center = { x: r * cos, y: r * sin };
  const half = widthUm / 2;
  const corners = [[-half, -half], [half, -half], [half, half], [-half, half]].map(([x, y]) => ({
    x: center.x + x * cos - y * sin,
    y: center.y + x * sin + y * cos
  }));
  if (!Number.isFinite(r) || !corners.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))) return null;
  return { r, center, corners };
}
