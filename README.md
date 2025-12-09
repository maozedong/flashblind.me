# HDR Glow Avatar Generator

**Turn your avatar into an eye-catching HDR glow that pops on every scroll.**

A browser-native tool that converts regular images into glowing HDR PNGs that display with enhanced brightness and vibrant colors on modern devices - iPhones, MacBooks, Samsung Galaxy, and most screens made after 2020.

## The Problem We Solved

Ever noticed those profile pictures on Twitter/X that seem to *glow* brighter than everything else on your feed? They're using HDR (High Dynamic Range) images with special color profiles that tell modern displays to crank up the brightness beyond normal limits.

The challenge? Creating these images typically requires:
- Command-line tools like ImageMagick
- Understanding of ICC color profiles (Rec.2020 PQ)
- Knowledge of PNG chunk structures
- A lot of trial and error

We wanted to make this accessible to everyone, right in the browser, with zero setup.

## The Journey: From 16-bit to Indexed PNGs

### First Attempt: magick-wasm
Our initial approach was to port ImageMagick to the browser using `magick-wasm`. This seemed perfect - use the same tool that creates working HDR images!

But we hit walls:
- CDN issues with WASM file loading
- ICC profile decompression failures in the browser environment
- Missing API methods (`evaluate()`, `modulate()`)
- The library just wasn't designed for our use case

### Second Attempt: Custom 16-bit PNG Encoder
We built a custom PNG encoder from scratch that could:
- Generate 16-bit RGBA images (Color Type 6)
- Embed iCCP chunks with the Rec.2020 PQ ICC profile
- Apply the same HDR boost transformations as ImageMagick

**It worked locally!** Images glowed beautifully on HDR displays.

**But Twitter rejected them.** The images would glow when viewed as standalone files, but once uploaded to Twitter, they displayed like normal SDR images.

### The Breakthrough: Metadata Comparison
We compared our output with images that *did* work on Twitter:

| Property | Working Image | Our Output |
|----------|--------------|------------|
| Type | Palette (Indexed) | TrueColor |
| Depth | 8-bit | 16-bit |
| Color Type | 3 | 6 |

Twitter requires **indexed/palette PNGs (Color Type 3)**, not TrueColor 16-bit!

### Final Solution: Indexed PNG with HDR Profile
We rewrote the encoder to produce indexed PNGs:
- **Median cut color quantization** to reduce colors to 256-color palette
- **Floyd-Steinberg dithering** to maintain visual quality
- **PLTE chunk** with the quantized palette
- **iCCP chunk** with Rec.2020 PQ profile
- **tRNS chunk** for transparency support

The result? HDR images that glow on Twitter, Instagram, Threads, Facebook, and everywhere else.

## Features

- **100% Browser-Native**: No server, no uploads to third parties
- **Real-time Preview**: See the glow effect instantly
- **Adjustable Settings**:
  - Brightness boost (0.5x - 3x)
  - Saturation control (0.5x - 2x)
  - Quality/resolution scaling
- **Drag & Drop**: Just drop your image and go
- **Wide Format Support**: PNG, JPEG, WebP, HEIC, AVIF, GIF, TIFF, BMP
- **Privacy First**: All processing happens locally in your browser

## Platform Compatibility

| Platform | Status |
|----------|--------|
| Instagram | Full support |
| Threads | Full support |
| X / Twitter | Works great |
| Facebook | Full support |
| Discord | As file share |
| TikTok | Videos only |

## How It Works

1. **Load Image**: Drop or select any image
2. **Convert to Linear RGB**: Remove sRGB gamma curve
3. **Auto-Gamma Normalization**: Balance exposure based on luminance
4. **Brightness Boost**: Multiply by 1.5x (adjustable)
5. **Gamma Correction**: Apply pow(0.9) for HDR look
6. **Saturation Adjustment**: Enhance or reduce color intensity
7. **Color Quantization**: Reduce to 256-color palette using median cut
8. **Dithering**: Apply Floyd-Steinberg for smooth gradients
9. **PNG Encoding**: Create indexed PNG with Rec.2020 PQ ICC profile

## Local Development

```bash
# Clone the repo
git clone https://github.com/maozedong/hdr-glow.git
cd hdr-glow

# Install dependencies
npm install

# Start local server
npm start

# Open http://localhost:3000
```

## Technical Details

### PNG Structure
```
PNG Signature
├── IHDR (width, height, bit depth=8, color type=3)
├── iCCP (Rec.2020 PQ ICC profile, deflate compressed)
├── PLTE (up to 256 RGB colors)
├── tRNS (alpha values for palette entries)
├── IDAT (palette indices, deflate compressed)
└── IEND
```

### ICC Profile
We use the ITU-R BT.2100 PQ (Perceptual Quantizer) transfer function with Rec.2020 color primaries. This tells HDR-capable displays to render colors outside the standard sRGB gamut and with brightness levels up to 10,000 nits (though practical displays max out around 1,000-1,600 nits).

### Color Quantization
The median cut algorithm recursively splits the color space along the axis with the largest range, creating optimally distributed palette colors. Combined with Floyd-Steinberg error diffusion dithering, this maintains excellent visual quality even with only 256 colors.

## Browser Compatibility

Works in all modern browsers:
- Chrome 80+
- Firefox 75+
- Safari 13.1+
- Edge 80+

Requires `pako` library for zlib compression (loaded from CDN).

## Credits

Built with frustration, determination, and lots of PNG specification reading.

The HDR glow effect is achieved using the Rec.2020 PQ color profile, which is part of the ITU-R BT.2100 standard for HDR video.

## License

MIT

---

**If this tool helped you stand out on social media, consider [buying me a coffee](https://buymeacoffee.com/ostapnagovitsyn)!**
