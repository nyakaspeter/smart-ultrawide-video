import type { PixelFrame } from '../../src/core/types';

export function solidFrame(width: number, height: number, level = 180): PixelFrame {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    data[offset] = level;
    data[offset + 1] = level;
    data[offset + 2] = level;
    data[offset + 3] = 255;
  }
  return { data, width, height };
}

export function fillRect(
  frame: PixelFrame,
  left: number,
  top: number,
  right: number,
  bottom: number,
  level: number,
): void {
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const offset = (y * frame.width + x) * 4;
      frame.data[offset] = level;
      frame.data[offset + 1] = level;
      frame.data[offset + 2] = level;
      frame.data[offset + 3] = 255;
    }
  }
}
