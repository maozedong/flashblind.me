const express = require('express');
const multer = require('multer');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3333;

// Create uploads and output directories
const uploadsDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

// Path to the Rec2020-PQ ICC profile (the magic ingredient!)
const iccProfilePath = path.join(__dirname, 'rec2020-pq.icc');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/avif', 'image/gif', 'image/tiff', 'image/bmp'];
    // Also accept by extension for browsers that don't set correct mimetype
    const allowedExts = ['.png', '.jpg', '.jpeg', '.webp', '.heic', '.avif', '.gif', '.tiff', '.tif', '.bmp'];
    const ext = require('path').extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Supported: PNG, JPG, WEBP, HEIC, AVIF, GIF, TIFF, BMP'));
    }
  }
});

// Serve static files
app.use(express.static(__dirname));
app.use('/output', express.static(outputDir));

// Convert image to HDR
app.post('/convert', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' });
  }

  const brightness = parseFloat(req.body.brightness) || 1.8;
  const saturation = parseFloat(req.body.saturation) || 1.1;

  const inputPath = req.file.path;
  const outputFilename = `hdr-${Date.now()}.png`;
  const outputPath = path.join(outputDir, outputFilename);

  try {
    await convertToHDR(inputPath, outputPath, { brightness, saturation });

    // Verify HDR metadata
    const metadata = await verifyHDR(outputPath);

    // Clean up input file
    fs.unlinkSync(inputPath);

    res.json({
      success: true,
      filename: outputFilename,
      url: `/output/${outputFilename}`,
      metadata
    });
  } catch (error) {
    console.error('Conversion error:', error);
    // Clean up on error
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    res.status(500).json({ error: error.message });
  }
});

// Download endpoint
app.get('/download/:filename', (req, res) => {
  const filePath = path.join(outputDir, req.params.filename);
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

function convertToHDR(inputPath, outputPath, options) {
  return new Promise((resolve, reject) => {
    const { brightness, saturation } = options;

    // The key insight: The PQ ICC profile tells the display to interpret
    // pixel values using the PQ transfer curve. In PQ:
    // - Value 255 (in 8-bit) maps to ~10,000 nits (super bright!)
    // - Value 200 maps to ~500 nits
    // - Value 127 maps to ~100 nits (SDR white)
    //
    // So bright pixels in the source image will "glow" because PQ
    // interprets them as much brighter than SDR white.
    //
    // We just need to:
    // 1. Optionally boost brightness/saturation for more dramatic effect
    // 2. Convert to PNG
    // 3. Embed the PQ ICC profile

    // Use eq filter for brightness/saturation adjustment
    // eq brightness is additive (-1 to 1), convert our multiplier
    const eqBrightness = (brightness - 1) * 0.5; // Map 1-3 to 0-1
    const eqSaturation = saturation;

    const args = [
      '-y',
      '-i', inputPath,
      '-vf', `eq=brightness=${eqBrightness}:saturation=${eqSaturation}`,
      '-update', '1',
      outputPath
    ];

    console.log(`FFmpeg: brightness=${eqBrightness}, saturation=${eqSaturation}`);

    const ffmpeg = spawn('ffmpeg', args);

    let stderr = '';
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
        return;
      }

      // Embed the Rec2020-PQ ICC profile - this is the magic!
      // The profile tells displays to interpret pixel values using PQ curve,
      // which makes bright colors appear to glow above normal white
      try {
        console.log('Embedding PQ ICC profile...');
        execSync(`exiftool -icc_profile'<=${iccProfilePath}' -overwrite_original '${outputPath}'`);
        console.log('ICC profile embedded - HDR glow enabled!');
        resolve();
      } catch (err) {
        reject(new Error(`Failed to embed ICC profile: ${err.message}`));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(new Error(`FFmpeg error: ${err.message}`));
    });
  });
}

function verifyHDR(filePath) {
  return new Promise((resolve, reject) => {
    try {
      // Use exiftool to check ICC profile
      const output = execSync(`exiftool -ProfileDescription -ColorPrimaries -TransferCharacteristics '${filePath}'`).toString();

      const profileDesc = output.match(/Profile Description\s*:\s*(.+)/)?.[1] || 'N/A';
      const colorPrimaries = output.match(/Color Primaries\s*:\s*(.+)/)?.[1] || 'N/A';
      const transferChar = output.match(/Transfer Characteristics\s*:\s*(.+)/)?.[1] || 'N/A';

      resolve({
        profile: profileDesc,
        color_primaries: colorPrimaries,
        transfer_function: transferChar,
        format: 'PNG with ICC profile'
      });
    } catch (err) {
      resolve({ error: err.message });
    }
  });
}

app.listen(PORT, () => {
  console.log(`HDR Glow server running at http://localhost:${PORT}`);
  console.log(`Using ICC profile: ${iccProfilePath}`);
});
