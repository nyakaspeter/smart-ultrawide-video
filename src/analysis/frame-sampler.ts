import type { FrameAnalysis } from '../core/types';
import { FrameAnalyzer } from './frame-analyzer';

export class FrameSampler {
  private timer: number | null = null;
  private frameCallback: number | null = null;
  private stopped = true;
  private activeVideo: HTMLVideoElement | null = null;
  private sampleHandler: ((analysis: FrameAnalysis) => void) | null = null;
  private waitingForPlay = false;
  private waitingForVisibility = false;
  private analysisIntervalMs = 0;
  private lastAnalysisAt: number | null = null;

  constructor(private readonly analyzer: FrameAnalyzer) {}

  setAnalysisInterval(intervalMs: number): void {
    const wasEventOnly = this.analysisIntervalMs < 0;
    this.analysisIntervalMs = Math.max(-1, intervalMs);
    this.lastAnalysisAt = null;
    if (this.stopped) return;

    if (this.analysisIntervalMs < 0) {
      this.suspendScheduling();
    } else if (wasEventOnly) {
      this.scheduleNextFrame();
    }
  }

  start(video: HTMLVideoElement, onSample: (analysis: FrameAnalysis) => void): void {
    this.stop();
    this.stopped = false;
    this.activeVideo = video;
    this.sampleHandler = onSample;
    this.lastAnalysisAt = null;

    if (this.analysisIntervalMs < 0) return;

    if (video.paused) {
      this.waitForPlayback(video);
    } else {
      this.scheduleNextFrame();
    }
  }

  stop(): void {
    this.stopped = true;
    this.suspendScheduling();

    this.timer = null;
    this.frameCallback = null;
    this.activeVideo = null;
    this.sampleHandler = null;
    this.waitingForPlay = false;
    this.waitingForVisibility = false;
    this.lastAnalysisAt = null;
  }

  private scheduleNextFrame(): void {
    const video = this.activeVideo;
    if (this.stopped || this.analysisIntervalMs < 0 || !video || !video.isConnected) return;

    if (document.visibilityState === 'hidden') {
      if (!this.waitingForVisibility) {
        this.waitingForVisibility = true;
        document.addEventListener('visibilitychange', this.onVisibilityChanged);
      }
      return;
    }

    if (video.paused) {
      this.waitForPlayback(video);
      return;
    }

    if (typeof video.requestVideoFrameCallback === 'function') {
      this.frameCallback = video.requestVideoFrameCallback(this.onVideoFrame);
    } else {
      this.timer = window.setTimeout(this.onVideoFrame, 16);
    }
  }

  private onVideoFrame = (now = performance.now()): void => {
    this.frameCallback = null;
    this.timer = null;
    const video = this.activeVideo;
    const onSample = this.sampleHandler;
    if (this.stopped || this.analysisIntervalMs < 0 || !video || !onSample) return;
    if (this.lastAnalysisAt === null || now - this.lastAnalysisAt >= this.analysisIntervalMs) {
      this.lastAnalysisAt = now;
      onSample(this.analyzer.analyze(video));
    }
    this.scheduleNextFrame();
  };

  private suspendScheduling(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    if (
      this.activeVideo
      && this.frameCallback !== null
      && typeof this.activeVideo.cancelVideoFrameCallback === 'function'
    ) {
      this.activeVideo.cancelVideoFrameCallback(this.frameCallback);
    }
    if (this.activeVideo && this.waitingForPlay) {
      this.activeVideo.removeEventListener('play', this.onPlaybackResumed);
    }
    if (this.waitingForVisibility) {
      document.removeEventListener('visibilitychange', this.onVisibilityChanged);
    }
    this.timer = null;
    this.frameCallback = null;
    this.waitingForPlay = false;
    this.waitingForVisibility = false;
  }

  private waitForPlayback(video: HTMLVideoElement): void {
    if (this.waitingForPlay) return;
    this.waitingForPlay = true;
    video.addEventListener('play', this.onPlaybackResumed, { once: true });
  }

  private onPlaybackResumed = (): void => {
    this.waitingForPlay = false;
    this.scheduleNextFrame();
  };

  private onVisibilityChanged = (): void => {
    if (document.visibilityState === 'hidden') return;
    this.waitingForVisibility = false;
    document.removeEventListener('visibilitychange', this.onVisibilityChanged);
    this.scheduleNextFrame();
  };
}
