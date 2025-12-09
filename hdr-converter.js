/**
 * Client-side HDR Glow Converter
 * Converts images to HDR-glowing PNGs by embedding a Rec2020-PQ ICC profile
 */

// Rec2020-PQ ICC Profile (base64 encoded)
const ICC_PROFILE_BASE64 = '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GBdnPoAAGBeAAIAAIe0AAIAAIe0EcIAAIe0JwIAAIe0QL4AAIe0YF4AAIe0h7YAAIe0uRIAAIe09vYAAIe1QyoAAIe1nPoAAIe2AAIAALkQAAIAALkQEcIAALkQJwIAALkQQL4AALkQYF4AALkQh7YAALkQuRIAALkQ9vYAALkRQyoAALkRnPoAALkSAAIAAPb0AAIAAPb0EcIAAPb0JwIAAPb0QL4AAPb0YF4AAPb0h7YAAPb0uRIAAPb09vYAAPb1QyoAAPb1nPoAAPb2AAIAAUMoAAIAAUMoEcIAAUMoJwIAAUMoQL4AAUMoYF4AAUMoh7YAAUMouRIAAUMo9vYAAUMpQyoAAUMpnPoAAUMqAAIAAZz4AAIAAZz4EcIAAZz4JwIAAZz4QL4AAZz4YF4AAZz4h7YAAZz4uRIAAZz49vYAAZz5QyoAAZz5nPoAAZz6AAIAAgAAAAIAAgAAEcIAAgAAJwIAAgAAQL4AAgAAYF4AAgAAh7YAAgAAuRIAAgAA9vYAAgABQyoAAgABnPoAAgACAAAAAY3VydgAAAAAAAABBAAAAAgAHABEAIAA4AFgAhAC/AQoBaQHhAnYDLQQKBRUGVAfPCY8LnA4DEMQT+hefG8UgZSWeK3cx5DjQQIRItlF+WrdkfG56eNuDio5UmUOkSK8yukPFVNBn27HnHPK9/t7//////////////////////////////////////////wAAY3VydgAAAAAAAABBAAAAAgAHABEAIAA4AFgAhAC/AQoBaQHhAnYDLQQKBRUGVAfPCY8LnA4DEMQT+hefG8UgZSWeK3cx5DjQQIRItlF+WrdkfG56eNuDio5UmUOkSK8yukPFVNBn27HnHPK9/t7//////////////////////////////////////////wAAY3VydgAAAAAAAABBAAAAAgAHABEAIAA4AFgAhAC/AQoBaQHhAnYDLQQKBRUGVAfPCY8LnA4DEMQT+hefG8UgZSWeK3cx5DjQQIRItlF+WrdkfG56eNuDio5UmUOkSK8yukPFVNBn27HnHPK9/t7//////////////////////////////////////////wAAAACsaAAAKmkAACAHAABHbwAArOMAAAuu////gQAAB60AAMwTAAAAAAAAAAAAAAAAcGFyYQAAAAAAAAAAAAEAAHBhcmEAAAAAAAAAAAABAABwYXJhAAAAAAAAAAAAAQAAbUJBIAAAAAADAwAAAAAAIAAAAAAAAAAAAAAAAAAAAABwYXJhAAAAAAAAAAAAAQAAcGFyYQAAAAAAAAAAAAEAAHBhcmEAAAAAAAAAAAABAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADY=';

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

// Minimal deflate implementation for compressing ICC profile
// Using raw deflate with no compression (store blocks) for simplicity
function deflateStore(data) {
  const chunks = [];
  let offset = 0;

  while (offset < data.length) {
    const isLast = (offset + 65535) >= data.length;
    const blockLen = Math.min(65535, data.length - offset);

    // Block header: BFINAL (1 if last) + BTYPE 00 (no compression)
    chunks.push(isLast ? 0x01 : 0x00);

    // Length and ones complement
    chunks.push(blockLen & 0xFF);
    chunks.push((blockLen >> 8) & 0xFF);
    chunks.push((~blockLen) & 0xFF);
    chunks.push(((~blockLen) >> 8) & 0xFF);

    // Data
    for (let i = 0; i < blockLen; i++) {
      chunks.push(data[offset + i]);
    }

    offset += blockLen;
  }

  return new Uint8Array(chunks);
}

// Adler-32 checksum for zlib
function adler32(data) {
  let a = 1, b = 0;
  const MOD = 65521;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % MOD;
    b = (b + a) % MOD;
  }
  return ((b << 16) | a) >>> 0;
}

// Wrap deflate data in zlib format
function zlibCompress(data) {
  const deflated = deflateStore(data);
  const checksum = adler32(data);

  // zlib header (no compression, no dict) + deflated data + adler32
  const result = new Uint8Array(2 + deflated.length + 4);
  result[0] = 0x78; // CMF: deflate, 32K window
  result[1] = 0x01; // FLG: no dict, check bits
  result.set(deflated, 2);

  // Adler-32 checksum (big endian)
  const checksumOffset = 2 + deflated.length;
  result[checksumOffset] = (checksum >> 24) & 0xFF;
  result[checksumOffset + 1] = (checksum >> 16) & 0xFF;
  result[checksumOffset + 2] = (checksum >> 8) & 0xFF;
  result[checksumOffset + 3] = checksum & 0xFF;

  return result;
}

// Parse PNG into chunks
function parsePNG(data) {
  const view = new DataView(data.buffer);
  const chunks = [];

  // Skip PNG signature (8 bytes)
  let offset = 8;

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

  // Length
  view.setUint32(0, data.length);

  // Type
  chunk[4] = type.charCodeAt(0);
  chunk[5] = type.charCodeAt(1);
  chunk[6] = type.charCodeAt(2);
  chunk[7] = type.charCodeAt(3);

  // Data
  chunk.set(data, 8);

  // CRC (over type + data)
  const crcData = new Uint8Array(4 + data.length);
  crcData.set(chunk.slice(4, 8), 0);
  crcData.set(data, 4);
  view.setUint32(8 + data.length, crc32(crcData));

  return chunk;
}

// Create iCCP chunk with ICC profile
function createICCPChunk(profileName, iccProfile) {
  // Profile name (null-terminated) + compression method (0 = deflate) + compressed profile
  const nameBytes = new TextEncoder().encode(profileName);
  const compressedProfile = zlibCompress(iccProfile);

  const data = new Uint8Array(nameBytes.length + 1 + 1 + compressedProfile.length);
  data.set(nameBytes, 0);
  data[nameBytes.length] = 0; // Null terminator
  data[nameBytes.length + 1] = 0; // Compression method (deflate)
  data.set(compressedProfile, nameBytes.length + 2);

  return createChunk('iCCP', data);
}

// Assemble PNG from chunks
function assemblePNG(chunks) {
  // Calculate total size
  let totalSize = 8; // PNG signature
  for (const chunk of chunks) {
    totalSize += 12 + chunk.data.length;
  }

  const result = new Uint8Array(totalSize);

  // PNG signature
  result.set([137, 80, 78, 71, 13, 10, 26, 10], 0);

  let offset = 8;
  for (const chunk of chunks) {
    const chunkBytes = createChunk(chunk.type, chunk.data);
    result.set(chunkBytes, offset);
    offset += chunkBytes.length;
  }

  return result;
}

// Base64 decode
function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Apply brightness and saturation adjustments to image data
function adjustImage(imageData, brightness, saturation) {
  const data = imageData.data;

  // Brightness adjustment (additive, like FFmpeg eq filter)
  // brightness slider 1 = no change, <1 = darker, >1 = brighter
  const brightAdjust = (brightness - 1) * 128; // Map to -128 to +256 range

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Apply brightness
    r = Math.min(255, Math.max(0, r + brightAdjust));
    g = Math.min(255, Math.max(0, g + brightAdjust));
    b = Math.min(255, Math.max(0, b + brightAdjust));

    // Apply saturation
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
  const { brightness = 1, saturation = 1 } = options;

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
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  // Get and adjust image data
  let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  imageData = adjustImage(imageData, brightness, saturation);
  ctx.putImageData(imageData, 0, 0);

  // Export as PNG blob
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  const arrayBuffer = await blob.arrayBuffer();
  const pngData = new Uint8Array(arrayBuffer);

  // Parse PNG chunks
  const chunks = parsePNG(pngData);

  // Remove any existing color profile chunks (iCCP, sRGB, cHRM, gAMA)
  const filteredChunks = chunks.filter(c =>
    !['iCCP', 'sRGB', 'cHRM', 'gAMA'].includes(c.type)
  );

  // Find IHDR position (should be first)
  const ihdrIndex = filteredChunks.findIndex(c => c.type === 'IHDR');

  // Create iCCP chunk with Rec2020-PQ profile
  const iccProfile = base64ToUint8Array(ICC_PROFILE_BASE64);
  const iccpChunk = createICCPChunk('Rec2020-PQ', iccProfile);

  // Parse the iCCP chunk back into our format
  const iccpData = iccpChunk.slice(8, iccpChunk.length - 4);

  // Insert iCCP chunk after IHDR
  filteredChunks.splice(ihdrIndex + 1, 0, {
    type: 'iCCP',
    data: iccpData
  });

  // Reassemble PNG
  const resultPNG = assemblePNG(filteredChunks);

  // Return as blob URL
  const resultBlob = new Blob([resultPNG], { type: 'image/png' });
  return {
    blob: resultBlob,
    url: URL.createObjectURL(resultBlob)
  };
}

// Export for use in HTML
window.HDRConverter = {
  convert: convertToHDR
};
