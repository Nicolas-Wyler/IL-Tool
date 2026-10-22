export const LIGHT_SPEED = 299792458;
export const TAU = 2 * Math.PI;

export function wrapDegrees(value) {
  const wrapped = value % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

export function inPlaneWavevector({ wavelength, theta, azimuth }) {
  const magnitude = TAU * Math.sin(theta * Math.PI / 180) / wavelength;
  const alpha = wrapDegrees(azimuth) * Math.PI / 180;
  return { ku: magnitude * Math.cos(alpha), kv: magnitude * Math.sin(alpha) };
}

export function phaseAt(uNm, vNm, timeSeconds, parameters) {
  const { ku, kv } = inPlaneWavevector(parameters);
  return ku * uNm + kv * vNm
    - TAU * LIGHT_SPEED * timeSeconds / (parameters.wavelength * 1e-9)
    + wrapDegrees(parameters.phase) * Math.PI / 180;
}

export function fieldAt(uNm, vNm, timeSeconds, parameters) {
  const { amplitude } = parameters;
  const angle = phaseAt(uNm, vNm, timeSeconds, parameters);
  const re = amplitude * Math.cos(angle);
  const im = amplitude * Math.sin(angle);
  return { re, im, phase: Math.atan2(im, re), intensity: amplitude * amplitude, realSquared: re * re };
}

export function superpositionAt(uNm, vNm, timeSeconds, waves) {
  let re = 0, im = 0;
  for (const wave of waves) {
    const field = fieldAt(uNm, vNm, timeSeconds, wave);
    re += field.re;
    im += field.im;
  }
  return { re, im, phase: Math.atan2(im, re), intensity: re * re + im * im, realSquared: re * re };
}

// Sample the square with v pointing up. Trigonometric recurrence along each
// row avoids evaluating sin/cos separately for every pixel of every wave.
export function fillSuperposition(real, imaginary, width, height, sideNm, timeSeconds, waves, centerU = 0, centerV = 0) {
  real.fill(0);
  imaginary.fill(0);
  const du = sideNm / width;
  const dv = sideNm / height;
  for (const wave of waves) {
    if (wave.amplitude === 0) continue;
    const { ku, kv } = inPlaneWavevector(wave);
    const origin = phaseAt(centerU + (-sideNm + du) / 2, centerV + (sideNm - dv) / 2, timeSeconds, wave);
    const cosStep = Math.cos(ku * du);
    const sinStep = Math.sin(ku * du);
    for (let y = 0; y < height; y++) {
      let re = wave.amplitude * Math.cos(origin - kv * dv * y);
      let im = wave.amplitude * Math.sin(origin - kv * dv * y);
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        real[index] += re;
        imaginary[index] += im;
        const nextReal = re * cosStep - im * sinStep;
        im = im * cosStep + re * sinStep;
        re = nextReal;
      }
    }
  }
}

export function phaseRGB(phase) {
  const hue = ((phase / TAU) % 1 + 1) % 1;
  const sector = hue * 6;
  const x = 1 - Math.abs(sector % 2 - 1);
  const colors = [[1,x,0], [x,1,0], [0,1,x], [0,x,1], [x,0,1], [1,0,x]];
  return colors[Math.floor(sector)].map(channel => Math.round(channel * 255));
}

const phasePalette = Array.from({ length: 4096 }, (_, i) => phaseRGB(TAU * i / 4096));

export function colorField(real, imaginary, mode, ceiling, data) {
  for (let index = 0; index < real.length; index++) {
    const re = real[index], im = imaginary[index], raw = re * re + im * im;
    const intensity = raw > ceiling * 1e-24 ? raw : 0, offset = index * 4;
    if (mode === 'complex' || mode === 'phase') {
      const brightness = intensity === 0 ? 0 : mode === 'complex' ? Math.min(1, intensity / ceiling) : 1;
      const turn = ((Math.atan2(im, re) / TAU) % 1 + 1) % 1;
      const color = phasePalette[Math.floor(turn * phasePalette.length)];
      for (let channel = 0; channel < 3; channel++) data[offset + channel] = Math.round(color[channel] * brightness);
    } else {
      const value = mode === 'intensity' ? intensity : intensity === 0 ? 0 : re * re;
      data[offset] = data[offset + 1] = data[offset + 2] = Math.round(255 * Math.min(1, value / ceiling));
    }
    data[offset + 3] = 255;
  }
  return data;
}
