/**
 * Client-side HDR Glow Converter
 * Converts images to HDR-glowing PNGs (indexed color, Color Type 3)
 * Twitter/X requires indexed color PNGs with PLTE chunk for HDR glow effect
 */

// Pre-compressed iCCP and cHRM data extracted from working HDR image
// This will be loaded from the reference file at runtime
let REFERENCE_ICCP_DATA = null;
let REFERENCE_CHRM_DATA = null;

// CRC32 lookup table for PNG chunk calculations
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  return table;
})();

function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Parse PNG into chunks
function parsePNG(data) {
  const view = new DataView(data.buffer);
  const chunks = [];
  let offset = 8; // Skip PNG signature

  while (offset < data.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7]);
    const chunkData = data.slice(offset + 8, offset + 8 + length);
    const crc = view.getUint32(offset + 8 + length);
    chunks.push({ type, data: chunkData, crc });
    offset += 12 + length;
  }
  return chunks;
}

// Create a PNG chunk
function createChunk(type, data) {
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk[4] = type.charCodeAt(0);
  chunk[5] = type.charCodeAt(1);
  chunk[6] = type.charCodeAt(2);
  chunk[7] = type.charCodeAt(3);
  chunk.set(data, 8);
  const crcData = new Uint8Array(4 + data.length);
  crcData.set(chunk.slice(4, 8), 0);
  crcData.set(data, 4);
  view.setUint32(8 + data.length, crc32(crcData));
  return chunk;
}

// Median cut color quantization
function quantizeColors(pixels, maxColors = 256) {
  const colorMap = new Map();
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    const key = `${r},${g},${b}`;
    if (!colorMap.has(key)) {
      colorMap.set(key, { r, g, b, count: 0 });
    }
    colorMap.get(key).count++;
  }

  let colors = Array.from(colorMap.values());
  if (colors.length <= maxColors) {
    return colors.map(c => ({ r: c.r, g: c.g, b: c.b }));
  }

  // Median cut algorithm
  const boxes = [colors];
  while (boxes.length < maxColors) {
    let maxRange = -1, maxRangeIdx = 0, maxRangeChannel = 'r';
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      if (box.length <= 1) continue;
      for (const channel of ['r', 'g', 'b']) {
        const values = box.map(c => c[channel]);
        const range = Math.max(...values) - Math.min(...values);
        if (range > maxRange) {
          maxRange = range;
          maxRangeIdx = i;
          maxRangeChannel = channel;
        }
      }
    }
    if (maxRange <= 0) break;
    const box = boxes[maxRangeIdx];
    box.sort((a, b) => a[maxRangeChannel] - b[maxRangeChannel]);
    const mid = Math.floor(box.length / 2);
    boxes.splice(maxRangeIdx, 1, box.slice(0, mid), box.slice(mid));
  }

  return boxes.map(box => {
    let totalWeight = 0, r = 0, g = 0, b = 0;
    for (const color of box) {
      const weight = color.count || 1;
      r += color.r * weight;
      g += color.g * weight;
      b += color.b * weight;
      totalWeight += weight;
    }
    return { r: Math.round(r / totalWeight), g: Math.round(g / totalWeight), b: Math.round(b / totalWeight) };
  });
}

// Find closest palette index for a color
function findClosestPaletteIndex(r, g, b, palette) {
  let minDist = Infinity, minIdx = 0;
  for (let i = 0; i < palette.length; i++) {
    const p = palette[i];
    const dist = (r - p.r) ** 2 + (g - p.g) ** 2 + (b - p.b) ** 2;
    if (dist < minDist) { minDist = dist; minIdx = i; }
  }
  return minIdx;
}

// Convert RGBA pixels to indexed
function convertToIndexed(pixels, palette, width, height) {
  const indexed = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = pixels[i * 4], g = pixels[i * 4 + 1], b = pixels[i * 4 + 2];
    indexed[i] = findClosestPaletteIndex(r, g, b, palette);
  }
  return indexed;
}

// Create IHDR chunk for indexed color
function createIHDRChunk(width, height) {
  const data = new Uint8Array(13);
  const view = new DataView(data.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  data[8] = 8;  // bit depth
  data[9] = 3;  // color type: indexed
  data[10] = 0; // compression
  data[11] = 0; // filter
  data[12] = 0; // interlace
  return { type: 'IHDR', data };
}

// Create PLTE chunk
function createPLTEChunk(palette) {
  const data = new Uint8Array(palette.length * 3);
  for (let i = 0; i < palette.length; i++) {
    data[i * 3] = palette[i].r;
    data[i * 3 + 1] = palette[i].g;
    data[i * 3 + 2] = palette[i].b;
  }
  return { type: 'PLTE', data };
}

// Create IDAT chunk with indexed data
function createIDATChunk(indexedPixels, width, height) {
  // Create filtered scanlines (filter type 0 = None)
  const rawData = new Uint8Array(height * (1 + width));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter type: None
    for (let x = 0; x < width; x++) {
      rawData[offset++] = indexedPixels[y * width + x];
    }
  }

  // Compress with pako (browser zlib)
  let compressed;
  if (typeof pako !== 'undefined') {
    compressed = pako.deflate(rawData, { level: 9 });
  } else {
    // Fallback: use raw store blocks if pako not available
    compressed = deflateStore(rawData);
  }

  return { type: 'IDAT', data: compressed };
}

// Minimal deflate store implementation (no compression)
function deflateStore(data) {
  const chunks = [];
  let offset = 0;

  // Zlib header
  chunks.push(0x78, 0x01);

  while (offset < data.length) {
    const isLast = (offset + 65535) >= data.length;
    const blockLen = Math.min(65535, data.length - offset);

    chunks.push(isLast ? 0x01 : 0x00);
    chunks.push(blockLen & 0xFF);
    chunks.push((blockLen >> 8) & 0xFF);
    chunks.push((~blockLen) & 0xFF);
    chunks.push(((~blockLen) >> 8) & 0xFF);

    for (let i = 0; i < blockLen; i++) {
      chunks.push(data[offset + i]);
    }
    offset += blockLen;
  }

  // Adler-32 checksum
  let a = 1, b = 0;
  const MOD = 65521;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % MOD;
    b = (b + a) % MOD;
  }
  const checksum = ((b << 16) | a) >>> 0;
  chunks.push((checksum >> 24) & 0xFF);
  chunks.push((checksum >> 16) & 0xFF);
  chunks.push((checksum >> 8) & 0xFF);
  chunks.push(checksum & 0xFF);

  return new Uint8Array(chunks);
}

// Assemble PNG from chunks
function assemblePNG(chunks) {
  let totalSize = 8;
  for (const chunk of chunks) {
    totalSize += 12 + chunk.data.length;
  }

  const result = new Uint8Array(totalSize);
  result.set([137, 80, 78, 71, 13, 10, 26, 10], 0);

  let offset = 8;
  for (const chunk of chunks) {
    const chunkBytes = createChunk(chunk.type, chunk.data);
    result.set(chunkBytes, offset);
    offset += chunkBytes.length;
  }

  return result;
}

// Load reference HDR data (iCCP and cHRM chunks)
async function loadReferenceHDR(url) {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const pngData = new Uint8Array(arrayBuffer);
    const chunks = parsePNG(pngData);

    const iccpChunk = chunks.find(c => c.type === 'iCCP');
    const chrmChunk = chunks.find(c => c.type === 'cHRM');

    if (iccpChunk) {
      REFERENCE_ICCP_DATA = iccpChunk.data;
      console.log('Loaded reference iCCP:', REFERENCE_ICCP_DATA.length, 'bytes');
    }
    if (chrmChunk) {
      REFERENCE_CHRM_DATA = chrmChunk.data;
      console.log('Loaded reference cHRM:', REFERENCE_CHRM_DATA.length, 'bytes');
    }

    return true;
  } catch (error) {
    console.error('Failed to load reference HDR:', error);
    return false;
  }
}

// Apply brightness and saturation adjustments
function adjustImage(imageData, brightness, saturation) {
  const data = imageData.data;
  const brightAdjust = (brightness - 1) * 128;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    r = Math.min(255, Math.max(0, r + brightAdjust));
    g = Math.min(255, Math.max(0, g + brightAdjust));
    b = Math.min(255, Math.max(0, b + brightAdjust));

    if (saturation !== 1) {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = Math.min(255, Math.max(0, gray + saturation * (r - gray)));
      g = Math.min(255, Math.max(0, gray + saturation * (g - gray)));
      b = Math.min(255, Math.max(0, gray + saturation * (b - gray)));
    }

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }

  return imageData;
}

// Main conversion function
async function convertToHDR(imageSource, options = {}) {
  const { brightness = 1, saturation = 1, quality = 1 } = options;

  // Ensure reference data is loaded
  if (!REFERENCE_ICCP_DATA) {
    console.warn('Reference HDR data not loaded, attempting to load...');
    await loadReferenceHDR('QbPcvO4h_400x400.png');
  }

  if (!REFERENCE_ICCP_DATA) {
    throw new Error('Failed to load reference HDR data. Cannot create HDR glow.');
  }

  // Load image
  const img = new Image();
  img.crossOrigin = 'anonymous';

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = imageSource;
  });

  // Create canvas and draw image
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * quality);
  canvas.height = Math.round(img.naturalHeight * quality);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // Get and adjust image data
  let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  imageData = adjustImage(imageData, brightness, saturation);

  const width = canvas.width;
  const height = canvas.height;
  const pixels = imageData.data;

  // Quantize to 256 colors
  console.log('Quantizing colors...');
  const palette = quantizeColors(pixels, 256);
  console.log('Palette:', palette.length, 'colors');

  // Convert to indexed
  console.log('Converting to indexed...');
  const indexedPixels = convertToIndexed(pixels, palette, width, height);

  // Build indexed PNG with HDR metadata
  console.log('Building indexed PNG...');
  const chunks = [
    createIHDRChunk(width, height),
    { type: 'iCCP', data: REFERENCE_ICCP_DATA },
  ];

  if (REFERENCE_CHRM_DATA) {
    chunks.push({ type: 'cHRM', data: REFERENCE_CHRM_DATA });
  }

  chunks.push(createPLTEChunk(palette));
  chunks.push(createIDATChunk(indexedPixels, width, height));
  chunks.push({ type: 'IEND', data: new Uint8Array(0) });

  // Assemble PNG
  const resultPNG = assemblePNG(chunks);
  console.log('Generated PNG:', resultPNG.length, 'bytes');

  // Return as blob URL
  const resultBlob = new Blob([resultPNG], { type: 'image/png' });
  return {
    blob: resultBlob,
    url: URL.createObjectURL(resultBlob)
  };
}

// Export for use in HTML
window.HDRConverter = {
  convert: convertToHDR,
  loadReference: loadReferenceHDR
};
