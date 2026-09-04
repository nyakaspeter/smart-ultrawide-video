import { FrameAnalyzer } from '../analysis/frame-analyzer';
import { FrameSampler } from '../analysis/frame-sampler';
import type { DetectedFrame, FrameAnalysis } from './types';
import { StyleController } from '../dom/style-controller';
import type { AppliedZoom } from '../dom/style-controller';
import { selectDominantVideo } from '../dom/video-selector';
import { findFullscreenRoot } from '../dom/fullscreen-root';
import { DEFAULT_ANALYSIS_INTERVAL_MS } from './settings';
import type { ExtensionSettings } from './settings';

export class FullscreenController {
  private readonly sampler: FrameSampler;
  private readonly styles = new StyleController();
  private activeVideo: HTMLVideoElement | null = null;
  private activeAnalysis: DetectedFrame | null = null;
  private analysisIntervalMs = DEFAULT_ANALYSIS_INTERVAL_MS;
  private resizeFrame: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private videoTreeObserver: MutationObserver | null = null;
  private debugViewEnabled = false;

  constructor(private readonly analyzer: FrameAnalyzer) {
    this.sampler = new FrameSampler(analyzer);
  }

  setPreferences(settings: ExtensionSettings): void {
    const debugViewChanged = settings.debugViewEnabled !== this.debugViewEnabled;
    this.debugViewEnabled = settings.debugViewEnabled;
    this.styles.setZoomTolerancePercent(settings.zoomTolerancePercent);
    this.styles.setZoomInDelayMs(settings.zoomInDelayMs);
    this.styles.setZoomOutDelayMs(settings.zoomOutDelayMs);
    this.styles.setZoomAnimationEnabled(settings.zoomAnimationEnabled);
    this.analyzer.setBlackBarLumaThreshold(settings.blackBarLumaThreshold);
    this.analyzer.setLogoTolerancePercent(settings.logoTolerancePercent);
    this.styles.setMaxZoomScale(settings.maxZoomScale);
    this.styles.setDebugView(settings.debugViewEnabled);
    this.analysisIntervalMs = settings.analysisIntervalMs;
    this.sampler.setAnalysisInterval(settings.analysisIntervalMs);
    if (debugViewChanged && this.activeVideo && this.activeAnalysis) {
      this.apply(this.activeAnalysis, 'viewport-resize');
    }
  }

  start(): void {
    document.addEventListener('fullscreenchange', this.onFullscreenChange, true);
    document.addEventListener('webkitfullscreenchange', this.onFullscreenChange, true);
    window.addEventListener('resize', this.onResize, { passive: true });
    window.addEventListener('orientationchange', this.onResize, { passive: true });
    window.visualViewport?.addEventListener('resize', this.onResize, { passive: true });

    const root = findFullscreenRoot();
    if (root) this.enter(root);
  }

  stop(): void {
    document.removeEventListener('fullscreenchange', this.onFullscreenChange, true);
    document.removeEventListener('webkitfullscreenchange', this.onFullscreenChange, true);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('orientationchange', this.onResize);
    window.visualViewport?.removeEventListener('resize', this.onResize);
    this.exit();
  }

  private onFullscreenChange = (): void => {
    const root = findFullscreenRoot();
    if (root) this.enter(root);
    else this.exit();
  };

  private enter(root: Element): void {
    this.exit();
    const video = selectDominantVideo(root);
    if (!video) return;

    this.observeVideoTree(root);
    this.activateVideo(root, video);
  }

  private activateVideo(root: Element, video: HTMLVideoElement): void {
    this.sampler.stop();
    this.detachVideoEvents();
    this.styles.restore();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    this.activeVideo = video;
    this.activeAnalysis = null;
    video.addEventListener('loadstart', this.onVideoLoadStart);
    this.styles.beginEntry(video, root);
    this.observeGeometry(root, video);

    // Analyze the already-decoded frame immediately, then analyze every new
    // decoded frame. There is no cache, prewarm, or temporal voting.
    this.onFrame(this.analyzer.analyze(video));
    this.sampler.start(video, this.onFrame);
  }

  private exit(): void {
    this.sampler.stop();
    this.detachVideoEvents();
    this.styles.restore();
    this.activeVideo = null;
    this.activeAnalysis = null;
    if (this.resizeFrame !== null) cancelAnimationFrame(this.resizeFrame);
    this.resizeFrame = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.videoTreeObserver?.disconnect();
    this.videoTreeObserver = null;
  }

  private onVideoLoadStart = (): void => {
    const root = findFullscreenRoot();
    const video = this.activeVideo;
    if (!root || !video || !video.isConnected) return;
    this.activateVideo(root, video);
  };

  private onFrame = (analysis: FrameAnalysis): void => {
    if (!this.activeVideo || !findFullscreenRoot()) return;

    if (analysis.kind === 'unreadable') {
      this.styles.showDebugStatus('unreadable', undefined, analysis.reason);
      this.styles.rejectFrame();
      this.styles.revealEntry();
      return;
    }

    if (analysis.isBlackFrame) {
      this.styles.showDebugStatus('black', analysis.signalPixelPercent);
      this.styles.rejectFrame();
      this.styles.revealEntry();
      return;
    }

    this.apply(analysis, 'video-frame');
  };

  private apply(analysis: DetectedFrame, trigger: 'video-frame' | 'viewport-resize'): void {
    const root = findFullscreenRoot();
    if (!root || !this.activeVideo) return;

    const result = this.styles.apply(
      this.activeVideo,
      root,
      analysis,
      trigger === 'viewport-resize',
    );
    if (!result) {
      this.styles.rejectFrame();
      this.styles.revealEntry();
      return;
    }

    if (result.changed) this.activeAnalysis = analysis;
    if (result.zoomChanged) this.logZoomChange(result);
  }

  private onResize = (): void => {
    const root = findFullscreenRoot();
    if (!root) {
      if (this.activeVideo) this.exit();
      return;
    }
    if (!this.activeVideo) {
      this.enter(root);
      return;
    }
    if (!this.activeAnalysis && this.analysisIntervalMs >= 0) return;

    if (this.resizeFrame !== null) cancelAnimationFrame(this.resizeFrame);
    this.resizeFrame = requestAnimationFrame(() => {
      this.resizeFrame = null;
      if (this.analysisIntervalMs < 0 && this.activeVideo) {
        const current = this.analyzer.analyze(this.activeVideo);
        if (
          current.kind === 'detected'
          && !current.isBlackFrame
        ) {
          this.apply(current, 'viewport-resize');
          return;
        }
      }
      if (this.activeAnalysis) this.apply(this.activeAnalysis, 'viewport-resize');
    });
  };

  private observeGeometry(root: Element, video: HTMLVideoElement): void {
    if (typeof ResizeObserver !== 'function') return;
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(root);
    if (video !== root) this.resizeObserver.observe(video);
  }

  private observeVideoTree(root: Element): void {
    if (typeof MutationObserver !== 'function') return;
    this.videoTreeObserver = new MutationObserver((mutations) => {
      const touchesVideo = mutations.some((mutation) =>
        [...mutation.addedNodes, ...mutation.removedNodes].some((node) =>
          node instanceof HTMLVideoElement
          || (node instanceof Element && node.querySelector('video') !== null)));
      if (!touchesVideo) return;

      const currentRoot = findFullscreenRoot();
      if (!currentRoot) return;
      const video = selectDominantVideo(currentRoot);
      if (video && video !== this.activeVideo) this.activateVideo(currentRoot, video);
    });
    this.videoTreeObserver.observe(root, { childList: true, subtree: true });
  }

  private detachVideoEvents(): void {
    this.activeVideo?.removeEventListener('loadstart', this.onVideoLoadStart);
  }

  private logZoomChange(result: AppliedZoom): void {
    const percent = (zoom: number): string => `${Number((zoom * 100).toFixed(2))}%`;
    console.log(
      `[Smart Ultrawide] Zoom changed: ${percent(result.previousZoom ?? 1)} → ${percent(result.appliedZoom)}`,
    );
  }
}
