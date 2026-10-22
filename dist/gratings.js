import { numberValue } from './numbers.js';
import { maskBounds, maskWidth, centerIfFits } from './framing.js';
import { setupViewport } from './viewport.js';
import { gratingSquare } from './grating-geometry.js';
import { fillCenterSquares } from './center-squares.js';

export function normalizeGratingState(saved) {
  if (!saved || !Array.isArray(saved.rows)) return null;
  const schema = Number(saved.schemaVersion) || 1;
  const fields = Array.isArray(saved.fields) ? [...saved.fields] : [];
  if (schema < 3) {
    const oldWidthNm = Number(fields[2]);
    // Replace the old dummy default; preserve the physical size of custom views.
    fields[2] = Number.isFinite(oldWidthNm) && oldWidthNm > 0 && oldWidthNm !== 100
      ? String(oldWidthNm / 1000) : '2000';
  }
  return {
    schemaVersion: 3,
    ...(saved.viewport ? { viewport: saved.viewport } : {}),
    rows: saved.rows.filter(Array.isArray).map(values => [
      schema < 2 ? '64' : String(values[0] ?? '64'),
      String(values[1] ?? '1'), String(values[2] ?? '0'),
      ...(typeof values[3] === 'string' && /^#[0-9a-f]{6}$/i.test(values[3]) ? [values[3]] : [])
    ]),
    fields
  };
}

export function setupGratings({ getRows }) {
  const wavelength = document.querySelector('#wavelength');
  const workingDistance = document.querySelector('#working-distance');
  const gratingWidth = document.querySelector('#grating-width');
  const plot = document.querySelector('.placeholder-square');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('grating-drawing');
  svg.setAttribute('aria-hidden', 'true');
  plot.prepend(svg);
  const centerCanvas = document.createElement('canvas');
  centerCanvas.width = centerCanvas.height = 640;
  centerCanvas.className = 'center-squares';
  centerCanvas.setAttribute('aria-hidden', 'true');
  svg.before(centerCanvas);
  const context = centerCanvas.getContext('2d', { alpha: false });
  const pixels = context.createImageData(640, 640);
  const geometry = () => maskBounds(getRows(), numberValue(wavelength), numberValue(workingDistance), numberValue(gratingWidth));
  const viewport = setupViewport(plot, { getWidth: () => maskWidth(geometry()), recenter: bounds => centerIfFits(geometry(), bounds.width), unit: 'µm', render });
  function render() {
    svg.replaceChildren();
    context.fillStyle = 'black';
    context.fillRect(0, 0, 640, 640);
    viewport.refresh();
    const lambda = numberValue(wavelength), distance = numberValue(workingDistance);
    const width = numberValue(gratingWidth), bounds = viewport.bounds(), side = bounds.width;
    if (![lambda, distance, width, side].every(Number.isFinite)
        || lambda <= 0 || distance < 0 || width <= 0 || side <= 0) return;
    svg.setAttribute('viewBox', `${bounds.x - side / 2} ${-bounds.y - side / 2} ${side} ${side}`);
    const cross = plot.querySelector('.center-cross');
    cross.style.left = `${(0.5 - bounds.x / side) * 100}%`;
    cross.style.top = `${(0.5 + bounds.y / side) * 100}%`;
    const centers = [];
    let count = 0;
    for (const row of getRows()) {
      const azimuth = row.gratingAzimuth;
      centers.push({ width, azimuth, efficiency: Number(row.efficiency) });
      const square = gratingSquare({ wavelengthNm: lambda,
        pitchNm: row.pitch === '' && Number(row.theta) === 0 ? Infinity : Number(row.pitch),
        workingDistanceUm: distance, widthUm: width, azimuthDeg: azimuth });
      if (!square) continue;
      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      polygon.setAttribute('points', square.corners.map(point => `${point.x},${-point.y}`).join(' '));
      polygon.classList.add('grating-outline');
      polygon.style.stroke = polygon.style.fill = row.color;
      polygon.style.fillOpacity = '0.2';
      svg.append(polygon);
      count++;
    }
    fillCenterSquares(pixels.data, 640, 640, bounds, centers);
    context.putImageData(pixels, 0, 0);
    plot.setAttribute('aria-label', `Grating layout: ${count} squares, ${side} µm square view`);
  }
  return { render,
    capture: () => ({ viewport: viewport.capture() }),
    restore: saved => {
      viewport.restore(saved?.viewport);
    }
  };
}
