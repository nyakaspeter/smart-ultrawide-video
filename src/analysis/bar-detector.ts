import type { DetectedFrame, NormalizedRect, PixelFrame } from '../core/types';
import { DEFAULT_BLACK_BAR_LUMA_THRESHOLD } from '../core/settings';

const MAX_SIDE_FRACTION = 0.47;
const MIN_BAR_PIXELS = 2;

function luminance(data: Uint8ClampedArray, offset: number): number {
  return (54 * data[offset]! + 183 * data[offset + 1]! + 19 * data[offset + 2]!) >> 8;
}

function rowIsBlack(frame: PixelFrame, y: number, threshold: number): boolean {
  for (let x = 0; x < frame.width; x += 1) {
    if (luminance(frame.data, (y * frame.width + x) * 4) > threshold) return false;
  }
  return true;
}

function columnIsBlack(frame: PixelFrame, x: number, threshold: number): boolean {
  for (let y = 0; y < frame.height; y += 1) {
    if (luminance(frame.data, (y * frame.width + x) * 4) > threshold) return false;
  }
  return true;
}

function blackRun(length: number, reverse: boolean, isBlack: (index: number) => boolean): number {
  const limit = Math.floor(length * MAX_SIDE_FRACTION);
  let size = 0;
  while (size < limit && isBlack(reverse ? length - 1 - size : size)) size += 1;
  return size;
}

function pairedBarSize(start: number, end: number): number {
  const hasStart = start >= MIN_BAR_PIXELS;
  const hasEnd = end >= MIN_BAR_PIXELS;
  if (!hasStart || !hasEnd) return 0;
  return Math.min(start, end);
}

export function detectContentRect(
  frame: PixelFrame,
  blackBarLumaThreshold = DEFAULT_BLACK_BAR_LUMA_THRESHOLD,
  logoTolerancePercent = 2.5,
): DetectedFrame {
  if (frame.width < 4 || frame.height < 4 || frame.data.length < frame.width * frame.height * 4) {
    return { kind: 'detected', content: { left: 0, top: 0, right: 1, bottom: 1 }, isBlackFrame: true };
  }

  const threshold = Math.min(255, Math.max(0, blackBarLumaThreshold));
  const maximumSignalPixels = Math.floor(
    frame.width * frame.height * Math.min(5, Math.max(0, logoTolerancePercent)) / 100,
  );
  let signalPixels = 0;
  for (let offset = 0; offset < frame.data.length; offset += 4) {
    if (luminance(frame.data, offset) > threshold) signalPixels += 1;
  }
  const signalPixelPercent = signalPixels / (frame.width * frame.height) * 100;
  if (signalPixels <= maximumSignalPixels) {
    return {
      kind: 'detected',
      content: { left: 0, top: 0, right: 1, bottom: 1 },
      isBlackFrame: true,
      signalPixelPercent,
    };
  }

  const verticalBarSize = pairedBarSize(
    blackRun(frame.width, false, (x) => columnIsBlack(frame, x, threshold)),
    blackRun(frame.width, true, (x) => columnIsBlack(frame, x, threshold)),
  );
  const horizontalBarSize = pairedBarSize(
    blackRun(frame.height, false, (y) => rowIsBlack(frame, y, threshold)),
    blackRun(frame.height, true, (y) => rowIsBlack(frame, y, threshold)),
  );
  const content: NormalizedRect = {
    left: verticalBarSize / frame.width,
    top: horizontalBarSize / frame.height,
    right: 1 - verticalBarSize / frame.width,
    bottom: 1 - horizontalBarSize / frame.height,
  };

  return {
    kind: 'detected',
    content,
    isBlackFrame: false,
    signalPixelPercent,
  };
}
