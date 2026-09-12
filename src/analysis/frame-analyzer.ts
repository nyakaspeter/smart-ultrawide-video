import { ANALYSIS_SHORT_EDGE } from '../core/constants';
import type { FrameAnalysis, PixelFrame } from '../core/types';
import { detectContentRect } from './bar-detector';
import { DEFAULT_BLACK_BAR_LUMA_THRESHOLD } from '../core/settings';
import { DEFAULT_LOGO_TOLERANCE_PERCENT } from '../core/settings';

type CanvasLike = OffscreenCanvas | HTMLCanvasElement;
type ContextLike = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

export class FrameAnalyzer {
  private canvas: CanvasLike | null = null;
  private context: ContextLike | null = null;
  private blackBarLumaThreshold = DEFAULT_BLACK_BAR_LUMA_THRESHOLD;
  private logoTolerancePercent = DEFAULT_LOGO_TOLERANCE_PERCENT;

  setBlackBarLumaThreshold(threshold: number): void {
    this.blackBarLumaThreshold = threshold;
  }

  setLogoTolerancePercent(percent: number): void {
    this.logoTolerancePercent = percent;
  }

  analyze(video: HTMLVideoElement): FrameAnalysis {
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0 || video.videoHeight === 0) {
      return { kind: 'unreadable', reason: 'not-ready' };
    }

    const { width, height } = this.sampleDimensions(video.videoWidth, video.videoHeight);
    const context = this.ensureContext(width, height);
    if (!context) return { kind: 'unreadable', reason: 'unsupported' };

    try {
      context.clearRect(0, 0, width, height);
      context.drawImage(video, 0, 0, width, height);
      const image = context.getImageData(0, 0, width, height);
      const frame: PixelFrame = { data: image.data, width, height };
      return detectContentRect(frame, this.blackBarLumaThreshold, this.logoTolerancePercent);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'SecurityError') {
        return { kind: 'unreadable', reason: 'security' };
      }
      return { kind: 'unreadable', reason: 'draw-failed' };
    }
  }

  dispose(): void {
    this.canvas = null;
    this.context = null;
  }

  private sampleDimensions(videoWidth: number, videoHeight: number): { width: number; height: number } {
    const scale = Math.min(1, ANALYSIS_SHORT_EDGE / Math.min(videoWidth, videoHeight));
    return {
      width: Math.max(1, Math.round(videoWidth * scale)),
      height: Math.max(1, Math.round(videoHeight * scale)),
    };
  }

  private ensureContext(width: number, height: number): ContextLike | null {
    if (!this.canvas) {
      this.canvas = typeof OffscreenCanvas === 'function'
        ? new OffscreenCanvas(width, height)
        : document.createElement('canvas');
      this.context = this.canvas.getContext('2d', {
        alpha: false,
        willReadFrequently: true,
      }) as ContextLike | null;
    }

    this.canvas.width = width;
    this.canvas.height = height;
    return this.context;
  }
}
