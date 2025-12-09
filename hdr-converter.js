/**
 * Client-side HDR Glow Converter
 * Converts images to indexed/palette PNG (Color Type 3) with Rec.2020 PQ ICC profile
 * This format is compatible with Twitter's HDR display
 */

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

// Create PNG chunk
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

// Create IHDR chunk for indexed/palette PNG (Color Type 3)
function createIHDR(width, height) {
  const data = new Uint8Array(13);
  const view = new DataView(data.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  data[8] = 8;  // bit depth (8-bit for palette indices)
  data[9] = 3;  // color type: Indexed (Palette)
  data[10] = 0; // compression
  data[11] = 0; // filter
  data[12] = 0; // interlace
  return createChunk('IHDR', data);
}

// Create iCCP chunk with compressed ICC profile
function createICCP(name, compressedProfile) {
  const nameBytes = new TextEncoder().encode(name);
  const data = new Uint8Array(nameBytes.length + 2 + compressedProfile.length);
  data.set(nameBytes, 0);
  data[nameBytes.length] = 0;     // null terminator
  data[nameBytes.length + 1] = 0; // compression method (0 = deflate)
  data.set(compressedProfile, nameBytes.length + 2);
  return createChunk('iCCP', data);
}

// Create PLTE chunk (palette with RGB colors)
function createPLTE(palette) {
  // palette is array of [r, g, b] values
  const data = new Uint8Array(palette.length * 3);
  for (let i = 0; i < palette.length; i++) {
    data[i * 3] = palette[i][0];
    data[i * 3 + 1] = palette[i][1];
    data[i * 3 + 2] = palette[i][2];
  }
  return createChunk('PLTE', data);
}

// Create tRNS chunk for palette transparency
function createTRNS(alphaValues) {
  const data = new Uint8Array(alphaValues.length);
  for (let i = 0; i < alphaValues.length; i++) {
    data[i] = alphaValues[i];
  }
  return createChunk('tRNS', data);
}

// Create IDAT chunk with palette indices
function createIDAT(indices, width, height) {
  // Create filtered scanlines (filter type 0 = None)
  const rowSize = 1 + width; // 1 filter byte + width palette indices
  const rawData = new Uint8Array(height * rowSize);

  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter type: None
    for (let x = 0; x < width; x++) {
      rawData[offset++] = indices[y * width + x];
    }
  }

  // Compress with pako
  const compressed = pako.deflate(rawData, { level: 6 });
  return createChunk('IDAT', compressed);
}

// Create IEND chunk
function createIEND() {
  return createChunk('IEND', new Uint8Array(0));
}

let iccProfile = null;

// Load ICC profile
async function loadIccProfile() {
  if (iccProfile) return iccProfile;

  try {
    const response = await fetch('./2020_profile.icc');
    if (response.ok) {
      iccProfile = new Uint8Array(await response.arrayBuffer());
      console.log('Loaded ICC profile from file:', iccProfile.byteLength, 'bytes');
      return iccProfile;
    }
  } catch (e) {
    console.warn('Failed to load ICC profile from file:', e);
  }

  // Fallback embedded profile (minimal Rec.2020 PQ)
  const ICC_PROFILE_BASE64 = 'AAD/YWNzcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABaWNjAAAAEGRlc2MAAAEkAAAAamJYWVoAAAGQAAAAFGJUUkMAAAGkAAAAIHJYWVoAAAHEAAAAFGdYWVoAAAHYAAAAFGdUUkMAAAGkAAAAIHJUUkMAAAGkAAAAIGNoYWQAAAHsAAAALGNwcnQAAAIYAAAAOGRlc2MAAAAAAAAAABBJVFVSXzIxMDBfUFFfRlVMTAAAAAAAAAAAAAAAABBJVFVSXzIxMDBfUFFfRlVMTAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWdGVzdAAAAABYWVogAAAAAAAA/YUAAEKDAABYy2N1cnYAAAAAAAAEAAAABQAIAAsAEAAVABsAIgApADIAOwBFAFAAXABpAHgAhwCYAKoAvQDRAOcA/QEVATABSwFpAYgBqQHMAe8CFgI+AmoClwLIAvsDMQNqA6UD4wQkBGcErQT2BUIF0AZhBvYHjggoB8YIaAkNibKxWllaIAAAAAAAAHOnAABhFQAAgWQAAAAAAAAAAAAARDJYWVogAAAAAAAAZnQAALiKAAAYRVhZWiAAAAAAAABpcgAAf7cAAJmGc2YzMgAAAAAAAQxCAAAF3v//8yYAAAeSAAD9kf//+6L///2jAAAD2gAAwHN0ZXh0AAAAAENvcHlyaWdodCAoYykgMjAxNSwgVzNDLCBJVFUtVAAAAAAA';
  const binary = atob(ICC_PROFILE_BASE64);
  iccProfile = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    iccProfile[i] = binary.charCodeAt(i);
  }
  console.log('Loaded embedded ICC profile:', iccProfile.byteLength, 'bytes');
  return iccProfile;
}

// Median cut color quantization for palette generation
function quantizeColors(pixels, maxColors = 256) {
  // Build color histogram
  const colorMap = new Map();
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];
    // Skip fully transparent pixels
    if (a === 0) continue;
    const key = (r << 16) | (g << 8) | b;
    colorMap.set(key, (colorMap.get(key) || 0) + 1);
  }

  // Convert to array of colors with counts
  let colors = Array.from(colorMap.entries()).map(([key, count]) => ({
    r: (key >> 16) & 0xFF,
    g: (key >> 8) & 0xFF,
    b: key & 0xFF,
    count
  }));

  // If we have fewer unique colors than max, use them all
  if (colors.length <= maxColors) {
    return colors.map(c => [c.r, c.g, c.b]);
  }

  // Median cut algorithm
  function medianCut(colors, depth) {
    if (depth === 0 || colors.length <= 1) {
      // Return average color of this bucket
      if (colors.length === 0) return [];
      let totalR = 0, totalG = 0, totalB = 0, totalCount = 0;
      for (const c of colors) {
        totalR += c.r * c.count;
        totalG += c.g * c.count;
        totalB += c.b * c.count;
        totalCount += c.count;
      }
      return [[
        Math.round(totalR / totalCount),
        Math.round(totalG / totalCount),
        Math.round(totalB / totalCount)
      ]];
    }

    // Find the channel with the largest range
    let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
    for (const c of colors) {
      minR = Math.min(minR, c.r); maxR = Math.max(maxR, c.r);
      minG = Math.min(minG, c.g); maxG = Math.max(maxG, c.g);
      minB = Math.min(minB, c.b); maxB = Math.max(maxB, c.b);
    }

    const rangeR = maxR - minR;
    const rangeG = maxG - minG;
    const rangeB = maxB - minB;

    // Sort by the channel with the largest range
    let sortKey;
    if (rangeR >= rangeG && rangeR >= rangeB) {
      sortKey = c => c.r;
    } else if (rangeG >= rangeR && rangeG >= rangeB) {
      sortKey = c => c.g;
    } else {
      sortKey = c => c.b;
    }
    colors.sort((a, b) => sortKey(a) - sortKey(b));

    // Split at median
    const mid = Math.floor(colors.length / 2);
    const left = colors.slice(0, mid);
    const right = colors.slice(mid);

    return [
      ...medianCut(left, depth - 1),
      ...medianCut(right, depth - 1)
    ];
  }

  // Calculate depth needed for maxColors buckets
  const depth = Math.ceil(Math.log2(maxColors));
  let palette = medianCut(colors, depth);

  // Trim to maxColors if we got more
  if (palette.length > maxColors) {
    palette = palette.slice(0, maxColors);
  }

  return palette;
}

// Find nearest color in palette
function findNearestColor(r, g, b, palette) {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const dr = r - palette[i][0];
    const dg = g - palette[i][1];
    const db = b - palette[i][2];
    // Weighted distance (human eye is more sensitive to green)
    const dist = dr * dr * 0.299 + dg * dg * 0.587 + db * db * 0.114;
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}

// Encode indexed PNG with ICC profile
function encodeIndexedPNG(width, height, indices, palette, alphaValues, iccData) {
  const chunks = [];

  // PNG signature
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  chunks.push(signature);

  // IHDR
  chunks.push(createIHDR(width, height));

  // iCCP (immediately after IHDR)
  if (iccData) {
    const compressedIcc = pako.deflate(iccData);
    chunks.push(createICCP('Rec2020-PQ', compressedIcc));
  }

  // PLTE
  chunks.push(createPLTE(palette));

  // tRNS (if we have any non-opaque colors)
  if (alphaValues && alphaValues.some(a => a < 255)) {
    chunks.push(createTRNS(alphaValues));
  }

  // IDAT
  chunks.push(createIDAT(indices, width, height));

  // IEND
  chunks.push(createIEND());

  // Concatenate all chunks
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

// sRGB to linear conversion
function srgbToLinear(c) {
  c = c / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

// Linear to sRGB conversion
function linearToSrgb(c) {
  c = Math.max(0, Math.min(1, c));
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1/2.4) - 0.055;
}

// Apply HDR boost transformations (matches ImageMagick pipeline)
function applyHDRBoost(r, g, b, brightness, saturation) {
  // Convert to linear RGB
  let lr = srgbToLinear(r);
  let lg = srgbToLinear(g);
  let lb = srgbToLinear(b);

  // Auto-gamma approximation (normalize based on luminance)
  const lum = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
  const gamma = lum > 0 ? Math.pow(0.5 / Math.max(lum, 0.01), 0.2) : 1;
  lr *= gamma;
  lg *= gamma;
  lb *= gamma;

  // Apply brightness boost (multiply by 1.5 * brightness factor)
  lr *= 1.5 * brightness;
  lg *= 1.5 * brightness;
  lb *= 1.5 * brightness;

  // Apply pow 0.9 (gamma correction for HDR look)
  lr = Math.pow(Math.min(1, Math.max(0, lr)), 0.9);
  lg = Math.pow(Math.min(1, Math.max(0, lg)), 0.9);
  lb = Math.pow(Math.min(1, Math.max(0, lb)), 0.9);

  // Apply saturation adjustment in linear space
  const gray = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
  lr = gray + saturation * (lr - gray);
  lg = gray + saturation * (lg - gray);
  lb = gray + saturation * (lb - gray);

  // Clamp and convert back to sRGB (8-bit for palette)
  return [
    Math.round(linearToSrgb(Math.max(0, Math.min(1, lr))) * 255),
    Math.round(linearToSrgb(Math.max(0, Math.min(1, lg))) * 255),
    Math.round(linearToSrgb(Math.max(0, Math.min(1, lb))) * 255)
  ];
}

// Main conversion function
async function convertToHDR(imageSource, options = {}) {
  const { brightness = 1, saturation = 1, quality = 1 } = options;

  // Load ICC profile
  const icc = await loadIccProfile();

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

  // Get image data
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels8 = imageData.data;
  const width = canvas.width;
  const height = canvas.height;

  console.log(`Converting ${width}x${height} image to indexed HDR PNG...`);

  // Apply HDR boost to all pixels first
  const boostedPixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const r = pixels8[i * 4];
    const g = pixels8[i * 4 + 1];
    const b = pixels8[i * 4 + 2];
    const a = pixels8[i * 4 + 3];

    const [br, bg, bb] = applyHDRBoost(r, g, b, brightness, saturation);
    boostedPixels[i * 4] = br;
    boostedPixels[i * 4 + 1] = bg;
    boostedPixels[i * 4 + 2] = bb;
    boostedPixels[i * 4 + 3] = a;
  }

  // Generate palette from boosted pixels (reserve index 0 for transparency if needed)
  const hasTransparency = Array.from({ length: width * height }, (_, i) => boostedPixels[i * 4 + 3]).some(a => a < 255);
  const maxPaletteColors = hasTransparency ? 255 : 256;

  let palette = quantizeColors(boostedPixels, maxPaletteColors);

  // If we have transparency, insert transparent color at index 0
  if (hasTransparency) {
    palette = [[0, 0, 0], ...palette]; // Transparent color placeholder
  }

  console.log(`Generated palette with ${palette.length} colors`);

  // Map pixels to palette indices with Floyd-Steinberg dithering
  const indices = new Uint8Array(width * height);
  const alphaValues = new Uint8Array(palette.length).fill(255);

  if (hasTransparency) {
    alphaValues[0] = 0; // Index 0 is fully transparent
  }

  // Create error buffer for dithering
  const errors = new Float32Array(width * height * 3);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const a = boostedPixels[i * 4 + 3];

      // Handle transparent pixels
      if (a < 128) {
        indices[i] = 0; // Transparent index
        continue;
      }

      // Get color with accumulated error
      let r = boostedPixels[i * 4] + errors[i * 3];
      let g = boostedPixels[i * 4 + 1] + errors[i * 3 + 1];
      let b = boostedPixels[i * 4 + 2] + errors[i * 3 + 2];

      // Clamp
      r = Math.max(0, Math.min(255, Math.round(r)));
      g = Math.max(0, Math.min(255, Math.round(g)));
      b = Math.max(0, Math.min(255, Math.round(b)));

      // Find nearest palette color (skip index 0 if it's transparent)
      const startIdx = hasTransparency ? 1 : 0;
      let bestIdx = startIdx;
      let bestDist = Infinity;
      for (let pi = startIdx; pi < palette.length; pi++) {
        const dr = r - palette[pi][0];
        const dg = g - palette[pi][1];
        const db = b - palette[pi][2];
        const dist = dr * dr * 0.299 + dg * dg * 0.587 + db * db * 0.114;
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = pi;
        }
      }

      indices[i] = bestIdx;

      // Calculate and distribute error (Floyd-Steinberg)
      const errR = r - palette[bestIdx][0];
      const errG = g - palette[bestIdx][1];
      const errB = b - palette[bestIdx][2];

      // Distribute error to neighboring pixels
      if (x + 1 < width) {
        errors[(i + 1) * 3] += errR * 7 / 16;
        errors[(i + 1) * 3 + 1] += errG * 7 / 16;
        errors[(i + 1) * 3 + 2] += errB * 7 / 16;
      }
      if (y + 1 < height) {
        if (x > 0) {
          errors[(i + width - 1) * 3] += errR * 3 / 16;
          errors[(i + width - 1) * 3 + 1] += errG * 3 / 16;
          errors[(i + width - 1) * 3 + 2] += errB * 3 / 16;
        }
        errors[(i + width) * 3] += errR * 5 / 16;
        errors[(i + width) * 3 + 1] += errG * 5 / 16;
        errors[(i + width) * 3 + 2] += errB * 5 / 16;
        if (x + 1 < width) {
          errors[(i + width + 1) * 3] += errR * 1 / 16;
          errors[(i + width + 1) * 3 + 1] += errG * 1 / 16;
          errors[(i + width + 1) * 3 + 2] += errB * 1 / 16;
        }
      }
    }
  }

  // Encode indexed PNG with ICC profile
  const pngBuffer = encodeIndexedPNG(width, height, indices, palette, alphaValues, icc);
  console.log('Generated indexed HDR PNG:', pngBuffer.length, 'bytes');

  // Return as blob URL
  const resultBlob = new Blob([pngBuffer], { type: 'image/png' });
  return {
    blob: resultBlob,
    url: URL.createObjectURL(resultBlob)
  };
}

// Dummy loadReference for backwards compatibility
async function loadReferenceHDR(url) {
  return true;
}

// Export for use in HTML
window.HDRConverter = {
  convert: convertToHDR,
  loadReference: loadReferenceHDR
};
