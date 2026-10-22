import { fillSuperposition, colorField } from './field.js';
import { waveFromRow, gratingAzimuth } from './linked-rows.js';
import { gratingSquare } from './grating-geometry.js';
import { scaleLength, scaleLabel } from './viewport.js';
import { projectFilename, serializeSettings } from './settings.js';
import { zipFiles, matrixCSV, additiveRegions, intersectPolygon } from './export-data.js';

const SIZE = 640;
const xml = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[ch]);
const pointText = polygon => polygon.map(p => `${p.x},${p.y}`).join(' ');
const text = (x, y, label, size, anchor = 'start') => `<text x="${x}" y="${y}" font-family="Helvetica,Arial,sans-serif" font-size="${size}" text-anchor="${anchor}" fill="white">${xml(label)}</text>`;
const gradients = '<defs><linearGradient id="brightness"><stop stop-color="black"/><stop offset="1" stop-color="white"/></linearGradient><linearGradient id="phase">'
  + ['#0ff','#00f','#f0f','#f00','#ff0','#0f0','#0ff'].map((color, i) => `<stop offset="${i / 6}" stop-color="${color}"/>`).join('') + '</linearGradient></defs>';
const svg = (contents, resolution = SIZE) => `<svg xmlns="http://www.w3.org/2000/svg" width="${resolution}" height="${resolution}" viewBox="0 0 ${SIZE} ${SIZE}">${contents}</svg>`;

function scaleSVG(bounds, unit, displaySize) {
  const s = SIZE / displaySize, length = scaleLength(bounds.width), width = length / bounds.width * SIZE;
  const right = SIZE - 12 * s, bottom = SIZE - 12 * s;
  return `<g style="filter:drop-shadow(0 1px 1px black)">${text(right - width / 2, bottom - 10 * s, scaleLabel(length, unit), 10 * s, 'middle')}`
    + `<path d="M${right - width},${bottom - 5 * s}v${5 * s}h${width}v${-5 * s}" fill="none" stroke="white" stroke-width="${s}"/></g>`;
}

function legendSVG(mode, displaySize) {
  const s = SIZE / displaySize, width = Math.min(SIZE / 2, 212 * s), x = 12 * s;
  const complex = mode === 'complex', brightness = mode !== 'phase', phase = mode === 'phase' || complex;
  const height = (14 + (complex ? 2 : 1) * 26) * s, y = SIZE - 12 * s - height;
  const left = x + 9 * s, right = x + width - 9 * s, rampWidth = right - left;
  const labels = (baseline, a, b, c) => text(left, baseline, a, 8 * s) + text((left + right) / 2, baseline, b, 8 * s, 'middle') + text(right, baseline, c, 8 * s, 'end');
  const ramp = (top, id) => `<rect x="${left}" y="${top}" width="${rampWidth}" height="${12 * s}" fill="url(#${id})" stroke="#383b44" stroke-width="${s}"/>`;
  let result = gradients + `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${5 * s}" fill="#101114" fill-opacity=".7" stroke="#ffffff" stroke-opacity=".15" stroke-width="${s}"/>`;
  let top = y + 7 * s;
  if (brightness) {
    const label = mode === 'realSquared' ? '[Re(Ẽ)]² (a.u.)' : '|Ẽ|² (a.u.)';
    if (complex) { result += labels(top + 8 * s, '0', label, '1'); top += 14 * s; }
    result += ramp(top, 'brightness'); top += 12 * s;
    if (!complex) { result += labels(top + 11 * s, '0', label, '1'); top += 14 * s; }
  }
  if (phase) result += ramp(top, 'phase') + labels(top + 23 * s, '−π', 'Phase', 'π');
  return result;
}

function maskExport(snapshot, bounds, displaySize, resolution) {
  const width = Number(snapshot.gratingWidth), lambda = Number(snapshot.wavelength), distance = Number(snapshot.workingDistance);
  const toPixel = polygon => polygon.map(p => ({ x: ((p.x - bounds.x) / bounds.width + .5) * SIZE, y: (.5 - (p.y - bounds.y) / bounds.width) * SIZE }));
  const boundary = [{ x: bounds.x - bounds.width / 2, y: bounds.y - bounds.width / 2 }, { x: bounds.x + bounds.width / 2, y: bounds.y - bounds.width / 2 },
    { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.width / 2 }, { x: bounds.x - bounds.width / 2, y: bounds.y + bounds.width / 2 }];
  const centered = [], gratings = [], rows = ['type,source_row,vertex,x_um,y_um,normalized_intensity,color'];
  snapshot.rows.forEach((row, index) => {
    const azimuth = gratingAzimuth(row), efficiency = Number(row.efficiency);
    const footprint = gratingSquare({ wavelengthNm: lambda, pitchNm: Infinity, workingDistanceUm: 0, widthUm: width, azimuthDeg: azimuth });
    if (footprint && efficiency > 0) centered.push({ polygon: footprint.corners, weight: efficiency });
    const square = gratingSquare({ wavelengthNm: lambda, pitchNm: row.pitch === '' && Number(row.theta) === 0 ? Infinity : Number(row.pitch),
      workingDistanceUm: distance, widthUm: width, azimuthDeg: azimuth });
    if (square) gratings.push({ polygon: square.corners, color: row.color, row: index + 1 });
  });
  const maximum = centered.reduce((sum, square) => sum + square.weight, 0);
  let contents = '<rect width="640" height="640" fill="black"/><defs><clipPath id="viewport"><rect width="640" height="640"/></clipPath></defs><g clip-path="url(#viewport)">';
  for (const region of additiveRegions(centered)) {
    const clipped = intersectPolygon(region.polygon, boundary);
    if (!clipped.length) continue;
    const brightness = region.weight / maximum;
    contents += `<polygon points="${pointText(toPixel(clipped))}" fill="rgb(${brightness * 100}%,${brightness * 100}%,${brightness * 100}%)"/>`;
    clipped.forEach((p, i) => rows.push(`center,,${i},${p.x},${p.y},${brightness},`));
  }
  const s = SIZE / displaySize;
  for (const grating of gratings) {
    contents += `<polygon points="${pointText(toPixel(grating.polygon))}" fill="${grating.color}" fill-opacity=".2" stroke="${grating.color}" stroke-width="${1.5 * s}"/>`;
    intersectPolygon(grating.polygon, boundary).forEach((p, i) => rows.push(`grating,${grating.row},${i},${p.x},${p.y},,${grating.color}`));
  }
  const origin = toPixel([{ x: 0, y: 0 }])[0];
  contents += `<path d="M${origin.x - 4.5 * s},${origin.y}h${9 * s}M${origin.x},${origin.y - 4.5 * s}v${9 * s}" stroke="#e6e8ed" stroke-width="${s}"/></g>`;
  return { drawing: svg(contents + scaleSVG(bounds, 'µm', displaySize), resolution), data: rows.join('\n') + '\n' };
}

async function pngWithOverlays(canvas, overlays, resolution) {
  const drawing = svg(`<image href="${canvas.toDataURL('image/png')}" width="640" height="640"/>${overlays}`, resolution);
  const url = URL.createObjectURL(new Blob([drawing], { type: 'image/svg+xml' }));
  try {
    const image = new Image(); image.src = url; await image.decode();
    const result = document.createElement('canvas'); result.width = result.height = resolution;
    result.getContext('2d').drawImage(image, 0, 0);
    return await new Promise((resolve, reject) => result.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not create image.')), 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}

export function setupExport({ capture, fieldBounds, maskBounds, valid }) {
  const button = document.querySelector('#export');
  button.addEventListener('click', async () => {
    if (!valid()) return;
    button.disabled = true; button.setAttribute('aria-busy', 'true');
    try {
      // Capture both viewports and one physical instant before asynchronous encoding.
      const snapshot = capture(), field = fieldBounds(), mask = maskBounds();
      const resolution = snapshot.exportResolution ?? SIZE;
      const fieldSize = document.querySelector('.field-surface').getBoundingClientRect().width;
      const maskSize = document.querySelector('.placeholder-square').getBoundingClientRect().width;
      const waves = snapshot.rows.map(row => waveFromRow(row, Number(snapshot.wavelength)));
      const ceiling = Math.max(1, waves.reduce((sum, wave) => sum + wave.amplitude, 0) ** 2);
      const real = new Float64Array(resolution * resolution), imaginary = new Float64Array(resolution * resolution);
      fillSuperposition(real, imaginary, resolution, resolution, field.width, snapshot.timeSeconds, waves, field.x, field.y);
      const left = maskExport(snapshot, mask, maskSize, resolution);
      const files = [{ name: 'mask.svg', data: left.drawing }, { name: 'mask-polygons.csv', data: left.data },
        { name: projectFilename(snapshot.projectName), data: serializeSettings(snapshot) }];
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = resolution;
      const context = canvas.getContext('2d'), pixels = context.createImageData(resolution, resolution);
      const modes = [['complex','complex-field'], ['intensity','intensity'], ['phase','phase'], ['realSquared','real-squared']];
      for (const [mode, name] of modes) {
        colorField(real, imaginary, mode, ceiling, pixels.data); context.putImageData(pixels, 0, 0);
        files.push({ name: `${name}.png`, data: await pngWithOverlays(canvas, legendSVG(mode, fieldSize) + scaleSVG(field, 'nm', fieldSize), resolution) });
      }
      const values = {
        'complex-real': i => real[i], 'complex-imaginary': i => imaginary[i],
        intensity: i => real[i] ** 2 + imaginary[i] ** 2,
        'phase-radians': i => Math.atan2(imaginary[i], real[i]), 'real-squared': i => real[i] ** 2
      };
      for (const [name, value] of Object.entries(values)) files.push({ name: `${name}.csv`, data: matrixCSV(resolution, resolution, value) });
      files.push({ name: 'coordinates.csv', data: 'pixel,x_nm,y_nm\n' + Array.from({ length: resolution }, (_, i) =>
        `${i},${field.x + ((i + .5) / resolution - .5) * field.width},${field.y + (.5 - (i + .5) / resolution) * field.width}`).join('\n') + '\n' });
      const { projectSavedFingerprint, ...settings } = snapshot;
      files.push({ name: 'metadata.json', data: JSON.stringify({ settings, fieldBoundsNm: field, maskBoundsUm: mask,
        matrixShape: [resolution, resolution], samples: 'pixel centers; columns increase x; rows decrease y',
        units: { real: 'a.u.', imaginary: 'a.u.', intensity: 'a.u.', phase: 'radians', realSquared: 'a.u.' },
        displayIntensityDivisor: ceiling, csvValues: 'raw, unnormalized; phase at exact zero is undefined' }, null, 2) });
      const zip = await zipFiles(files), url = URL.createObjectURL(zip), link = document.createElement('a');
      link.href = url; link.download = projectFilename(snapshot.projectName).replace(/\.iltool$/, '.zip'); link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      const message = document.createElement('div'); message.className = 'update-toast'; message.role = 'status';
      message.textContent = error.message || 'Could not export plots.'; document.body.append(message); setTimeout(() => message.remove(), 3500);
    } finally { button.disabled = false; button.removeAttribute('aria-busy'); }
  });
}
