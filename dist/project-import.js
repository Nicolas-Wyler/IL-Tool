import { crc32 } from './export-data.js';

const MAX_PROJECT = 10 * 1024 * 1024;
const decoder = new TextDecoder();
const invalidZip = () => new Error('This ZIP file is invalid or damaged.');
const bytesAt = async (file, start, end) => new Uint8Array(await file.slice(start, end).arrayBuffer());
const viewOf = bytes => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

async function projectEntries(file) {
  if (file.size < 22) throw invalidZip();
  const tailStart = Math.max(0, file.size - 65557);
  const tail = await bytesAt(file, tailStart, file.size), end = viewOf(tail);
  let offset = tail.length - 22;
  for (; offset >= 0; offset--) {
    if (end.getUint32(offset, true) === 0x06054b50 && offset + 22 + end.getUint16(offset + 20, true) === tail.length) break;
  }
  if (offset < 0) throw invalidZip();
  const count = end.getUint16(offset + 10, true), size = end.getUint32(offset + 12, true), start = end.getUint32(offset + 16, true);
  if (end.getUint16(offset + 4, true) || end.getUint16(offset + 6, true)
      || end.getUint16(offset + 8, true) !== count || count === 0xffff || start === 0xffffffff || size === 0xffffffff) {
    throw new Error('Split and ZIP64 archives are not supported.');
  }
  if (size > 16 * 1024 * 1024 || start + size > tailStart + offset) throw invalidZip();
  const bytes = await bytesAt(file, start, start + size), directory = viewOf(bytes), entries = [];
  let cursor = 0;
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > bytes.length || directory.getUint32(cursor, true) !== 0x02014b50) throw invalidZip();
    const nameLength = directory.getUint16(cursor + 28, true), extraLength = directory.getUint16(cursor + 30, true), commentLength = directory.getUint16(cursor + 32, true);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    if (next > bytes.length) throw invalidZip();
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength)).replace(/\\/g, '/');
    if (/\.iltool$/i.test(name) && !name.split('/').some(part => part === '__MACOSX' || part.startsWith('._'))) {
      entries.push({ name, flags: directory.getUint16(cursor + 8, true), method: directory.getUint16(cursor + 10, true),
        crc: directory.getUint32(cursor + 16, true), compressedSize: directory.getUint32(cursor + 20, true),
        size: directory.getUint32(cursor + 24, true), offset: directory.getUint32(cursor + 42, true), directoryStart: start });
    }
    cursor = next;
  }
  return entries;
}

async function extractProject(file, entry) {
  if (entry.flags & 1 || entry.size > MAX_PROJECT || entry.compressedSize > 2 * MAX_PROJECT || ![0, 8].includes(entry.method)) throw invalidZip();
  const header = await bytesAt(file, entry.offset, entry.offset + 30), local = viewOf(header);
  if (header.length !== 30 || local.getUint32(0, true) !== 0x04034b50 || local.getUint16(6, true) & 1
      || local.getUint16(8, true) !== entry.method) throw invalidZip();
  const start = entry.offset + 30 + local.getUint16(26, true) + local.getUint16(28, true);
  if (start + entry.compressedSize > entry.directoryStart) throw invalidZip();
  const data = file.slice(start, start + entry.compressedSize);
  let bytes;
  if (entry.method === 0) bytes = new Uint8Array(await data.arrayBuffer());
  else {
    // Only decompress the small project, never the exported images or matrices.
    const reader = data.stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
    bytes = new Uint8Array(entry.size); let position = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (position + value.length > bytes.length) throw invalidZip();
        bytes.set(value, position); position += value.length;
      }
      if (position !== bytes.length) throw invalidZip();
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  }
  if (bytes.length !== entry.size || crc32(bytes) !== entry.crc) throw invalidZip();
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export async function readProjectFile(file, parseProject) {
  const signature = viewOf(await bytesAt(file, 0, 4));
  const zip = /\.zip$/i.test(file.name) || /zip/i.test(file.type)
    || signature.byteLength === 4 && [0x04034b50, 0x06054b50].includes(signature.getUint32(0, true));
  const name = file.name.replace(/\.(zip|iltool|json)$/i, '');
  if (!zip) {
    if (file.size > MAX_PROJECT) throw new Error('The project file is too large.');
    return { name, settings: parseProject(await file.text()) };
  }
  const entries = await projectEntries(file);
  if (!entries.length) throw new Error('This ZIP contains no .iltool project file.');
  const preferred = `${name}.iltool`.toLowerCase();
  entries.sort((a, b) => Number(b.name.split('/').at(-1).toLowerCase() === preferred) - Number(a.name.split('/').at(-1).toLowerCase() === preferred));
  for (const entry of entries) {
    try { return { name, settings: parseProject(await extractProject(file, entry)) }; }
    catch { /* Another project in the archive may still be compatible. */ }
  }
  throw new Error('No compatible .iltool project could be loaded from this ZIP. The project may be damaged or from an unsupported version.');
}
