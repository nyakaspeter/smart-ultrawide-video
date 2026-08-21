import { ANALYSIS_LONG_EDGE, ANALYSIS_MIN_EDGE } from '../core/constants';
import type { FrameAnalysis, PixelFrame } from '../core/types';
import { detectContentRect } from './bar-detector';

type CanvasLike = OffscreenCanvas | HTMLCanvasElement;
type ContextLike = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

export class FrameAnalyzer {
  private canvas: CanvasLike | null = null;
  private context: ContextLike | null = null;

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
      return detectContentRect(frame);
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
    const scale = ANALYSIS_LONG_EDGE / Math.max(videoWidth, videoHeight);
    return {
      width: Math.max(ANALYSIS_MIN_EDGE, Math.round(videoWidth * scale)),
      height: Math.max(ANALYSIS_MIN_EDGE, Math.round(videoHeight * scale)),
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
