import type { DetectedFrame, NormalizedRect, PixelFrame } from '../core/types';

const BASE_BLACK_LEVEL = 24;
const MAX_BLACK_LEVEL = 48;
const BLACK_FRAME_SIGNAL_LEVEL = 12;
const MIN_EDGE_CONTRAST = 6;
const MIN_SUSTAINED_EDGE_CONTRAST = 2;
const MAX_SIDE_FRACTION = 0.47;
const MIN_BAR_PIXELS = 2;
const LINE_SAMPLE_STEP = 2;
const BAR_CONTAMINATION_MARGIN = 16;
const MAX_IGNORED_EDGE_LUMA_CHANGE = 1;
const MIN_TRUSTED_AXIS_CONFIDENCE = 0.45;

interface LineProfile {
  darkLevel: number;
  signalLevel: number;
  highLevel: number;
}

interface EdgeCandidate {
  kind: 'bar' | 'no-bar' | 'ambiguous';
  size: number;
  confidence: number;
}

interface ReconciledPair {
  start: number;
  end: number;
  confidence: number;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

function luminance(data: Uint8ClampedArray, offset: number): number {
  return (54 * data[offset]! + 183 * data[offset + 1]! + 19 * data[offset + 2]!) >> 8;
}

function sortedPercentile(values: number[], fraction: number): number {
  if (values.length === 0) return 0;
  return values[Math.min(values.length - 1, Math.floor(values.length * fraction))]!;
}

function percentile(values: number[], fraction: number): number {
  values.sort((a, b) => a - b);
  return sortedPercentile(values, fraction);
}

function lineProfile(values: number[], tolerateHorizontalOverlay = false): LineProfile {
  values.sort((a, b) => a - b);
  return {
    darkLevel: sortedPercentile(values, tolerateHorizontalOverlay ? 0.7 : 0.75),
    signalLevel: sortedPercentile(values, tolerateHorizontalOverlay ? 0.7 : 0.85),
    highLevel: sortedPercentile(values, tolerateHorizontalOverlay ? 0.7 : 0.98),
  };
}

function horizontalProfile(frame: PixelFrame): LineProfile[] {
  const result: LineProfile[] = [];
  for (let y = 0; y < frame.height; y += 1) {
    const values: number[] = [];
    for (let x = 0; x < frame.width; x += LINE_SAMPLE_STEP) {
      values.push(luminance(frame.data, (y * frame.width + x) * 4));
    }
    result.push(lineProfile(values, true));
  }
  return result;
}

function verticalProfile(frame: PixelFrame): LineProfile[] {
  const result: LineProfile[] = [];
  for (let x = 0; x < frame.width; x += 1) {
    const values: number[] = [];
    for (let y = 0; y < frame.height; y += LINE_SAMPLE_STEP) {
      values.push(luminance(frame.data, (y * frame.width + x) * 4));
    }
    result.push(lineProfile(values));
  }
  return result;
}

function globalSignal(frame: PixelFrame): number {
  const values: number[] = [];
  const stride = Math.max(1, Math.floor(Math.sqrt((frame.width * frame.height) / 1_500)));
  for (let y = 0; y < frame.height; y += stride) {
    for (let x = 0; x < frame.width; x += stride) {
      values.push(luminance(frame.data, (y * frame.width + x) * 4));
    }
  }
  // A dark but visible frame can have meaningful signal in only a small part
  // of the picture. Ignore the darkest 95%, but do not let isolated pixels
  // turn a genuine fade-to-black into a usable frame.
  return percentile(values, 0.95);
}

function scanEdge(profile: LineProfile[], reverse: boolean, blackLevel: number): EdgeCandidate {
  const maxDepth = Math.floor(profile.length * MAX_SIDE_FRACTION);
  const at = (index: number): LineProfile =>
    profile[reverse ? profile.length - 1 - index : index]!;
  const outerDarkLevel = at(0).darkLevel;

  let darkRun = 0;
  let darkSignalTotal = 0;
  const darkHighLevels: number[] = [];
  for (let index = 0; index < maxDepth; index += 1) {
    const line = at(index);
    const nextLine = at(Math.min(index + 1, profile.length - 1));
    const hasSustainedDarknessChange = index >= MIN_BAR_PIXELS
      && line.darkLevel > outerDarkLevel + MAX_IGNORED_EDGE_LUMA_CHANGE
      && nextLine.darkLevel > outerDarkLevel + MAX_IGNORED_EDGE_LUMA_CHANGE;
    const isDark = !hasSustainedDarknessChange
      && line.darkLevel <= blackLevel
      && line.signalLevel <= blackLevel + 8;
    if (isDark) {
      darkRun += 1;
      darkSignalTotal += line.signalLevel;
      darkHighLevels.push(line.highLevel);
      continue;
    }

    if (darkRun < MIN_BAR_PIXELS) {
      const contrast = line.signalLevel - blackLevel;
      if (contrast < MIN_EDGE_CONTRAST) {
        return { kind: 'ambiguous', size: 0, confidence: 0 };
      }
      const relativeContrast = contrast / Math.max(line.signalLevel, 1);
      return {
        kind: 'no-bar',
        size: 0,
        confidence: clamp(relativeContrast, 0, 1),
      };
    }

    const following = [line, at(Math.min(index + 1, profile.length - 1)), at(Math.min(index + 2, profile.length - 1))];
    const contentLevel = following.reduce((sum, value) => sum + value.signalLevel, 0) / following.length;
    const barLevel = darkSignalTotal / darkRun;
    const typicalHighLevel = percentile(darkHighLevels, 0.5);
    if (typicalHighLevel > blackLevel + BAR_CONTAMINATION_MARGIN) {
      return { kind: 'ambiguous', size: 0, confidence: 0 };
    }
    const contrast = contentLevel - barLevel;
    const requiredContrast = hasSustainedDarknessChange
      ? MIN_SUSTAINED_EDGE_CONTRAST
      : MIN_EDGE_CONTRAST;
    if (contrast < requiredContrast) {
      return { kind: 'ambiguous', size: 0, confidence: 0 };
    }

    const relativeContrast = contrast / Math.max(contentLevel, 1);
    const absoluteCertainty = clamp((contrast - requiredContrast) / 18, 0, 1);

    return {
      kind: 'bar',
      size: darkRun,
      confidence: clamp(relativeContrast * (0.8 + 0.2 * absoluteCertainty), 0, 1),
    };
  }

  return { kind: 'ambiguous', size: 0, confidence: 0 };
}

function reconcilePair(
  start: EdgeCandidate,
  end: EdgeCandidate,
  dimension: number,
): ReconciledPair {
  if (start.kind === 'no-bar' && end.kind === 'no-bar') {
    return { start: 0, end: 0, confidence: Math.min(start.confidence, end.confidence) };
  }
  if (start.kind !== 'bar' || end.kind !== 'bar') {
    return { start: 0, end: 0, confidence: 0 };
  }

  const mismatch = Math.abs(start.size - end.size);
  const tolerance = Math.max(2, Math.round(dimension * 0.035));
  if (mismatch > tolerance) return { start: 0, end: 0, confidence: 0.3 };

  const symmetry = 1 - mismatch / Math.max(start.size, end.size, 1);
  return {
    start: start.size,
    end: end.size,
    confidence: clamp(Math.min(start.confidence, end.confidence) * (0.75 + 0.25 * symmetry), 0, 1),
  };
}

function discardWeakBars(pair: ReconciledPair): ReconciledPair {
  const hasBars = pair.start > 0 || pair.end > 0;
  return hasBars && pair.confidence < MIN_TRUSTED_AXIS_CONFIDENCE
    ? { start: 0, end: 0, confidence: 0 }
    : pair;
}

export function detectContentRect(frame: PixelFrame): DetectedFrame {
  if (frame.width < 4 || frame.height < 4 || frame.data.length < frame.width * frame.height * 4) {
    return {
      kind: 'detected',
      content: { left: 0, top: 0, right: 1, bottom: 1 },
      confidence: 0,
      isBlackFrame: true,
    };
  }

  const signal = globalSignal(frame);
  if (signal <= BLACK_FRAME_SIGNAL_LEVEL) {
    return {
      kind: 'detected',
      content: { left: 0, top: 0, right: 1, bottom: 1 },
      confidence: 0,
      isBlackFrame: true,
    };
  }

  const blackLevel = clamp(Math.min(BASE_BLACK_LEVEL, signal * 0.28), 8, MAX_BLACK_LEVEL);
  const rows = horizontalProfile(frame);
  const columns = verticalProfile(frame);
  const verticalBars = discardWeakBars(reconcilePair(
    scanEdge(columns, false, blackLevel),
    scanEdge(columns, true, blackLevel),
    frame.width,
  ));
  const horizontalBars = discardWeakBars(reconcilePair(
    scanEdge(rows, false, blackLevel),
    scanEdge(rows, true, blackLevel),
    frame.height,
  ));

  const content: NormalizedRect = {
    left: verticalBars.start / frame.width,
    top: horizontalBars.start / frame.height,
    right: 1 - verticalBars.end / frame.width,
    bottom: 1 - horizontalBars.end / frame.height,
  };

  const hasVerticalBars = verticalBars.start > 0 || verticalBars.end > 0;
  const hasHorizontalBars = horizontalBars.start > 0 || horizontalBars.end > 0;
  const confidenceParts = hasVerticalBars || hasHorizontalBars
    ? [
        ...(hasVerticalBars ? [verticalBars.confidence] : []),
        ...(hasHorizontalBars ? [horizontalBars.confidence] : []),
      ]
    : [verticalBars.confidence, horizontalBars.confidence];

  return {
    kind: 'detected',
    content,
    confidence: Math.min(...confidenceParts),
    isBlackFrame: false,
  };
}
