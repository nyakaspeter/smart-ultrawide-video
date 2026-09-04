export interface NormalizedRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface PixelFrame {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface DetectedFrame {
  kind: 'detected';
  content: NormalizedRect;
  isBlackFrame: boolean;
  signalPixelPercent?: number;
}

export interface UnreadableFrame {
  kind: 'unreadable';
  reason: 'not-ready' | 'security' | 'unsupported' | 'draw-failed';
}

export type FrameAnalysis = DetectedFrame | UnreadableFrame;

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}
