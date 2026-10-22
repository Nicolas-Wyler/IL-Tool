const encoder = new TextEncoder();
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  return value >>> 0;
});
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// Standard ZIP, stored entries: no network dependency or proprietary reader.
export async function zipFiles(files) {
  const parts = [], directory = []; let offset = 0, directorySize = 0;
  const header = size => { const bytes = new Uint8Array(size); return { bytes, view: new DataView(bytes.buffer) }; };
  for (const file of files) {
    const name = encoder.encode(file.name);
    const bytes = typeof file.data === 'string' ? encoder.encode(file.data)
      : file.data instanceof Uint8Array ? file.data : new Uint8Array(await file.data.arrayBuffer());
    const crc = crc32(bytes), local = header(30), central = header(46);
    local.view.setUint32(0, 0x04034b50, true); local.view.setUint16(4, 20, true);
    local.view.setUint16(6, 0x800, true); local.view.setUint16(12, 33, true);
    local.view.setUint32(14, crc, true); local.view.setUint32(18, bytes.length, true);
    local.view.setUint32(22, bytes.length, true); local.view.setUint16(26, name.length, true);
    central.view.setUint32(0, 0x02014b50, true); central.view.setUint16(4, 20, true); central.view.setUint16(6, 20, true);
    central.view.setUint16(8, 0x800, true); central.view.setUint16(14, 33, true);
    central.view.setUint32(16, crc, true); central.view.setUint32(20, bytes.length, true); central.view.setUint32(24, bytes.length, true);
    central.view.setUint16(28, name.length, true); central.view.setUint32(42, offset, true);
    parts.push(local.bytes, name, bytes); directory.push(central.bytes, name);
    offset += 30 + name.length + bytes.length; directorySize += 46 + name.length;
  }
  const end = header(22); end.view.setUint32(0, 0x06054b50, true);
  end.view.setUint16(8, files.length, true); end.view.setUint16(10, files.length, true);
  end.view.setUint32(12, directorySize, true); end.view.setUint32(16, offset, true);
  return new Blob([...parts, ...directory, end.bytes], { type: 'application/zip' });
}

export function matrixCSV(width, height, value) {
  const lines = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) row.push(String(value(y * width + x)));
    lines.push(row.join(','));
  }
  return lines.join('\n') + '\n';
}

const side = (point, a, b) => (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
function halfPlane(polygon, a, b, inside) {
  const result = [];
  const epsilon = 64 * Number.EPSILON * Math.max(1, ...polygon.flatMap(p => [Math.abs(p.x), Math.abs(p.y)]));
  const edge = Math.hypot(b.x - a.x, b.y - a.y);
  if (edge <= epsilon) return polygon;
  const distance = p => { const d = side(p, a, b) * inside / edge; return Math.abs(d) <= epsilon ? 0 : d; };
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length];
    const dp = distance(p), dq = distance(q);
    if (dp >= 0) result.push(p);
    if ((dp >= 0) !== (dq >= 0)) {
      const t = dp / (dp - dq);
      result.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
    }
  }
  const unique = result.filter((p, i) => {
    const previous = result[(i + result.length - 1) % result.length];
    return Math.hypot(p.x - previous.x, p.y - previous.y) > epsilon;
  });
  return unique.length >= 3 && polygonArea(unique) > epsilon * epsilon ? unique : [];
}
export function polygonArea(polygon) {
  return Math.abs(polygon.reduce((area, p, i) => { const q = polygon[(i + 1) % polygon.length]; return area + p.x * q.y - q.x * p.y; }, 0)) / 2;
}
export function intersectPolygon(polygon, clip) {
  for (let i = 0; i < clip.length && polygon.length; i++) polygon = halfPlane(polygon, clip[i], clip[(i + 1) % clip.length], 1);
  return polygon;
}
function subtractPolygon(polygon, clip) {
  const outside = [];
  for (let i = 0; i < clip.length && polygon.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length], piece = halfPlane(polygon, a, b, -1);
    if (piece.length) outside.push(piece);
    polygon = halfPlane(polygon, a, b, 1);
  }
  return outside;
}
// Disjoint vector regions reproduce linear intensity addition exactly.
export function additiveRegions(squares) {
  let regions = [];
  for (const square of squares) {
    if (!(square.weight > 0)) continue;
    let remaining = [square.polygon]; const next = [];
    for (const region of regions) {
      const intersection = intersectPolygon(region.polygon, square.polygon);
      if (intersection.length) {
        next.push(...subtractPolygon(region.polygon, square.polygon).map(polygon => ({ polygon, weight: region.weight })));
        next.push({ polygon: intersection, weight: region.weight + square.weight });
        remaining = remaining.flatMap(polygon => subtractPolygon(polygon, region.polygon));
      } else next.push(region);
    }
    next.push(...remaining.map(polygon => ({ polygon, weight: square.weight })));
    regions = next;
  }
  return regions;
}
