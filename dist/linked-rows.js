import { wrapDegrees } from './field.js';
import { normalizeWaveState } from './persistence.js';
import { normalizeGratingState } from './gratings.js';

const numeric = value => value !== '' && Number.isFinite(Number(value));
const display = value => Number.isFinite(value) ? String(Number(value.toPrecision(12))) : '';

export function pitchFromTheta(wavelength, theta) {
  return wavelength / Math.abs(Math.sin(theta * Math.PI / 180));
}

export function phaseFromPath(wavelengthNm, workingDistanceUm, theta) {
  if (!(wavelengthNm > 0) || !(workingDistanceUm >= 0) || Math.abs(theta) >= 90) return NaN;
  const pathNm = workingDistanceUm * 1000 / Math.cos(theta * Math.PI / 180);
  return wrapDegrees(360 * ((pathNm % wavelengthNm) / wavelengthNm));
}

export function linkRow(row, wavelength, workingDistance, mode) {
  const linked = { ...row };
  if (mode === 'pitch') {
    const sign = row.angleSign === -1 ? -1 : row.angleSign === 1 ? 1 : Number(row.theta) < 0 ? -1 : 1;
    const valid = numeric(row.pitch) && wavelength > 0 && Number(row.pitch) > wavelength;
    const theta = valid ? sign * Math.asin(wavelength / Number(row.pitch)) * 180 / Math.PI : NaN;
    linked.theta = display(theta);
    linked.angleSign = sign;
  } else {
    const theta = Number(row.theta);
    linked.pitch = numeric(row.theta) && wavelength > 0 && Math.abs(theta) <= 90
      ? display(pitchFromTheta(wavelength, theta)) : '';
    linked.angleSign = numeric(row.theta) ? (theta < 0 ? -1 : 1) : row.angleSign ?? 1;
  }
  linked.phase = numeric(linked.theta) ? display(phaseFromPath(wavelength, workingDistance, Number(linked.theta))) : '';
  linked.radius = numeric(linked.theta) && Math.abs(Number(linked.theta)) < 90 && workingDistance >= 0
    ? display(workingDistance * Math.tan(Math.abs(Number(linked.theta)) * Math.PI / 180)) : '';
  return linked;
}

// The table retains the signed wave-angle convention. Place each grating
// opposite its wave's transverse wavevector so the chosen order travels inward.
export function gratingAzimuth(row) {
  return wrapDegrees(Number(row.azimuth) + (Number(row.theta) > 0 ? 180 : 0));
}

export function waveFromRow(row, wavelength) {
  return { wavelength, theta: Number(row.theta), phase: Number(row.phase), azimuth: Number(row.azimuth),
    amplitude: Math.sqrt(Number(row.efficiency)) };
}

export function defaultRows() {
  return [0, 60, 120, 180, 240, 300].map(azimuth => ({
    theta: '', phase: '', pitch: '40', efficiency: '1', azimuth: String(azimuth), angleSign: 1
  }));
}

export function normalizeLinkedState(saved) {
  if (!saved) return null;
  if (saved.schemaVersion === 3 && Array.isArray(saved.rows)) {
    return { ...saved, editMode: saved.editMode === 'pitch' ? 'pitch' : 'wave',
      rows: saved.rows.filter(row => row && typeof row === 'object').map(row => ({
        ...row, theta: String(row.theta ?? '30'), phase: String(row.phase ?? '0'), pitch: String(row.pitch ?? ''),
        efficiency: String(row.efficiency ?? '1'), azimuth: String(row.azimuth ?? '0')
      })) };
  }
  const legacy = normalizeWaveState(saved);
  if (!legacy) return null;
  const gratings = normalizeGratingState(saved.gratings);
  const wavelength = Number(legacy.wavelength);
  const count = Math.max(legacy.waves.length, gratings?.rows.length ?? 0);
  const rows = Array.from({ length: count }, (_, index) => {
    const wave = legacy.waves[index], grating = gratings?.rows[index];
    if (wave) return {
      theta: wave[1], phase: wave[2], azimuth: wave[3], pitch: '',
      efficiency: grating?.[1] ?? display(Math.min(1, Math.max(0, Number(wave[0]) ** 2))),
      color: grating?.[3], angleSign: Number(wave[1]) < 0 ? -1 : 1
    };
    return { theta: display(-Math.asin(wavelength / Number(grating[0])) * 180 / Math.PI),
      phase: '0', pitch: grating[0], efficiency: grating[1], azimuth: grating[2], color: grating[3], angleSign: -1 };
  });
  return { ...legacy, schemaVersion: 3, rows, editMode: 'wave',
    workingDistance: gratings?.fields[0] ?? '2000', gratingWidth: gratings?.fields[1] ?? '80',
    layoutWidth: gratings?.fields[2] ?? '2000', layoutViewport: gratings?.viewport };
}
