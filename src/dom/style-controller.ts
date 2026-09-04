import type { Box, DetectedFrame } from '../core/types';
import {
  DEFAULT_ZOOM_ANIMATION_ENABLED,
  DEFAULT_ZOOM_IN_DELAY_MS,
  DEFAULT_ZOOM_OUT_DELAY_MS,
  DEFAULT_ZOOM_TOLERANCE_PERCENT,
  DEFAULT_MAX_ZOOM_SCALE,
  MAX_ZOOM_DELAY_MS,
} from '../core/settings';
import { calculateZoom, type SupportedObjectFit } from '../geometry/zoom-calculator';

interface SavedProperty {
  value: string;
  priority: string;
}

const VIDEO_PROPERTIES = ['transform', 'transform-origin', 'transition', 'will-change', 'visibility'] as const;
const CONTAINER_PROPERTIES = ['overflow'] as const;
const ZOOM_TRANSITION = 'transform 150ms ease-out';

export interface AppliedZoom {
  previousZoom: number | null;
  appliedZoom: number;
  changed: boolean;
  zoomChanged: boolean;
}

function saveProperties<T extends readonly string[]>(style: CSSStyleDeclaration, properties: T): Map<T[number], SavedProperty> {
  const saved = new Map<T[number], SavedProperty>();
  for (const property of properties) {
    saved.set(property, {
      value: style.getPropertyValue(property),
      priority: style.getPropertyPriority(property),
    });
  }
  return saved;
}

function restoreProperties(style: CSSStyleDeclaration, saved: Map<string, SavedProperty>): void {
  for (const [property, original] of saved) {
    if (original.value) style.setProperty(property, original.value, original.priority);
    else style.removeProperty(property);
  }
}

export class StyleController {
  private video: HTMLVideoElement | null = null;
  private container: HTMLElement | null = null;
  private videoStyles = new Map<string, SavedProperty>();
  private containerStyles = new Map<string, SavedProperty>();
  private appliedTransform: string | null = null;
  private appliedTransition = 'none';
  private appliedZoom: number | null = null;
  private elementBox: Box | null = null;
  private pendingZoomInSince: number | null = null;
  private pendingZoomOutSince: number | null = null;
  private zoomToleranceRatio = DEFAULT_ZOOM_TOLERANCE_PERCENT / 100;
  private zoomInDelayMs = DEFAULT_ZOOM_IN_DELAY_MS;
  private zoomOutDelayMs = DEFAULT_ZOOM_OUT_DELAY_MS;
  private zoomAnimationEnabled = DEFAULT_ZOOM_ANIMATION_ENABLED;
  private maxZoomScale = DEFAULT_MAX_ZOOM_SCALE;
  private debugView = false;
  private debugOverlay: HTMLDivElement | null = null;
  private debugStatus: HTMLDivElement | null = null;
  private videoStyleObserver: MutationObserver | null = null;
  private entryConcealed = false;

  constructor(private readonly now: () => number = () => performance.now()) {}

  setZoomTolerancePercent(percent: number): void {
    this.zoomToleranceRatio = Math.max(0, percent) / 100;
  }

  setZoomInDelayMs(delayMs: number): void {
    this.zoomInDelayMs = Math.min(MAX_ZOOM_DELAY_MS, Math.max(0, delayMs));
  }

  setZoomOutDelayMs(delayMs: number): void {
    this.zoomOutDelayMs = Math.min(MAX_ZOOM_DELAY_MS, Math.max(0, delayMs));
  }

  setZoomAnimationEnabled(enabled: boolean): void {
    this.zoomAnimationEnabled = enabled;
    if (!enabled && this.appliedTransition !== 'none') {
      this.appliedTransition = 'none';
      this.enforceAppliedStyles();
    }
  }

  setMaxZoomScale(scale: number): void {
    this.maxZoomScale = Math.max(1, scale);
  }

  setDebugView(enabled: boolean): void {
    if (this.debugView === enabled) return;
    this.debugView = enabled;
    this.removeDebugOverlay();
    if (enabled && this.appliedTransform) {
      this.appliedTransform = null;
      this.appliedTransition = 'none';
      this.appliedZoom = null;
      this.elementBox = null;
      this.pendingZoomInSince = null;
      this.pendingZoomOutSince = null;
      this.restoreSavedValues();
    }
  }

  rejectFrame(): void {
    this.pendingZoomInSince = null;
    this.pendingZoomOutSince = null;
  }

  beginEntry(video: HTMLVideoElement, fullscreenElement: Element): void {
    if (this.video !== video) this.restore();
    if (!this.video) this.initialize(video, fullscreenElement);
    video.style.setProperty('visibility', 'hidden', 'important');
    this.entryConcealed = true;
  }

  revealEntry(): void {
    if (!this.video || !this.entryConcealed) return;
    const original = this.videoStyles.get('visibility');
    if (original?.value) this.video.style.setProperty('visibility', original.value, original.priority);
    else this.video.style.removeProperty('visibility');
    this.entryConcealed = false;
  }

  apply(
    video: HTMLVideoElement,
    fullscreenElement: Element,
    analysis: DetectedFrame,
    force = false,
  ): AppliedZoom | null {
    if (this.video !== video) this.restore();
    if (!this.video) this.initialize(video, fullscreenElement);
    if (this.entryConcealed) this.revealEntry();

    if (this.elementBox === null || force) {
      if (this.appliedTransform) {
        this.appliedTransition = 'none';
        this.restoreSavedValues();
        video.style.setProperty('transition', 'none', 'important');
      }
      const rect = video.getBoundingClientRect();
      this.elementBox = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };
    }

    const computed = getComputedStyle(video);
    const objectFit = (['contain', 'cover', 'fill', 'none', 'scale-down'].includes(computed.objectFit)
      ? computed.objectFit
      : 'contain') as SupportedObjectFit;
    const visualViewport = window.visualViewport;
    const viewportWidth = visualViewport?.width
      ?? document.documentElement.clientWidth
      ?? window.innerWidth;
    const viewportHeight = visualViewport?.height
      ?? document.documentElement.clientHeight
      ?? window.innerHeight;
    const transform = calculateZoom({
      element: this.elementBox,
      viewport: {
        left: visualViewport?.offsetLeft ?? 0,
        top: visualViewport?.offsetTop ?? 0,
        width: viewportWidth || window.innerWidth,
        height: viewportHeight || window.innerHeight,
      },
      intrinsicWidth: video.videoWidth,
      intrinsicHeight: video.videoHeight,
      content: analysis.content,
      objectFit,
      maxScale: this.maxZoomScale,
    });
    if (!transform || !Number.isFinite(transform.scale) || transform.scale < 1) {
      this.enforceAppliedStyles();
      return null;
    }

    if (this.debugView) {
      this.showDebugOverlay(transform.contentBox);
      this.showDebugStatus('detected', analysis.signalPixelPercent);
      return {
        previousZoom: this.appliedZoom,
        appliedZoom: 1,
        changed: true,
        zoomChanged: false,
      };
    }
    this.removeDebugOverlay();

    const previousZoom = this.appliedZoom;
    const comparisonZoom = previousZoom ?? 1;
    const zoomDeltaRatio = Math.abs(transform.scale / comparisonZoom - 1);
    const exceedsTolerance = previousZoom === null || zoomDeltaRatio > this.zoomToleranceRatio;
    let changed = force || (previousZoom === null && transform.scale === 1);

    if (force || !exceedsTolerance) {
      this.pendingZoomInSince = null;
      this.pendingZoomOutSince = null;
    } else if (transform.scale > comparisonZoom) {
      this.pendingZoomOutSince = null;
      if (this.zoomInDelayMs === 0) changed = true;
      else {
        const now = this.now();
        this.pendingZoomInSince ??= now;
        changed = now - this.pendingZoomInSince >= this.zoomInDelayMs;
        if (changed) this.pendingZoomInSince = null;
      }
    } else if (transform.scale < comparisonZoom) {
      this.pendingZoomInSince = null;
      if (this.zoomOutDelayMs === 0) changed = true;
      else {
      const now = this.now();
      this.pendingZoomOutSince ??= now;
      changed = now - this.pendingZoomOutSince >= this.zoomOutDelayMs;
      if (changed) this.pendingZoomOutSince = null;
      }
    }
    const zoomChanged = changed && (previousZoom === null || transform.scale !== previousZoom);

    if (changed) {
      this.appliedZoom = transform.scale;
      this.appliedTransform = `translate3d(${transform.translateX}px, ${transform.translateY}px, 0) scale(${transform.scale})`;
      this.appliedTransition = this.zoomAnimationEnabled
        && zoomChanged
        && previousZoom !== null
        && !force
        ? ZOOM_TRANSITION
        : 'none';
    }

    this.enforceAppliedStyles();
    return {
      previousZoom,
      appliedZoom: this.appliedZoom ?? 1,
      changed,
      zoomChanged,
    };
  }

  restore(): void {
    this.videoStyleObserver?.disconnect();
    this.videoStyleObserver = null;
    this.restoreSavedValues();
    this.video = null;
    this.container = null;
    this.videoStyles.clear();
    this.containerStyles.clear();
    this.appliedTransform = null;
    this.appliedTransition = 'none';
    this.appliedZoom = null;
    this.elementBox = null;
    this.pendingZoomInSince = null;
    this.pendingZoomOutSince = null;
    this.entryConcealed = false;
    this.removeDebugOverlay();
  }

  showDebugStatus(
    state: 'detected' | 'black' | 'unreadable',
    signalPixelPercent?: number,
    unreadableReason?: string,
  ): void {
    if (!this.debugView) return;
    const colors = {
      detected: 'rgba(32,242,178,.95)',
      black: 'rgba(255,196,61,.95)',
      unreadable: 'rgba(255,91,112,.95)',
    };
    if (this.debugOverlay) this.debugOverlay.style.borderColor = colors[state];

    const status = this.debugStatus ?? document.createElement('div');
    if (!this.debugStatus) {
      status.dataset.smartUltrawideDebug = 'status';
      status.style.cssText = [
        'position:fixed',
        'left:12px',
        'top:12px',
        'z-index:2147483647',
        'pointer-events:none',
        'padding:6px 9px',
        'border-radius:6px',
        'background:rgba(0,0,0,.78)',
        'color:white',
        'font:12px/1.35 system-ui,sans-serif',
        'box-shadow:0 2px 12px rgba(0,0,0,.45)',
      ].join(';');
      document.documentElement.append(status);
      this.debugStatus = status;
    }
    status.style.border = `1px solid ${colors[state]}`;
    const percentage = signalPixelPercent === undefined
      ? ''
      : ` • ${Number(signalPixelPercent.toFixed(2))}% above threshold`;
    status.textContent = state === 'detected'
      ? `Detected geometry${percentage}`
      : state === 'black'
        ? `Black frame${percentage} • rectangle held`
        : `Unreadable frame${unreadableReason ? ` (${unreadableReason})` : ''} • rectangle held`;
  }

  private showDebugOverlay(box: Box): void {
    const overlay = this.debugOverlay ?? document.createElement('div');
    if (!this.debugOverlay) {
      overlay.dataset.smartUltrawideDebug = 'content';
      overlay.style.cssText = [
        'position:fixed',
        'pointer-events:none',
        'z-index:2147483647',
        'box-sizing:border-box',
        'border:3px solid rgba(32,242,178,.9)',
        'background:rgba(25,215,255,.18)',
        'box-shadow:0 0 0 1px rgba(0,0,0,.7),inset 0 0 24px rgba(25,215,255,.12)',
      ].join(';');
      document.documentElement.append(overlay);
      this.debugOverlay = overlay;
    }
    overlay.style.left = `${box.left}px`;
    overlay.style.top = `${box.top}px`;
    overlay.style.width = `${box.width}px`;
    overlay.style.height = `${box.height}px`;
  }

  private removeDebugOverlay(): void {
    this.debugOverlay?.remove();
    this.debugOverlay = null;
    this.debugStatus?.remove();
    this.debugStatus = null;
  }

  private initialize(video: HTMLVideoElement, fullscreenElement: Element): void {
    this.video = video;
    this.container = fullscreenElement instanceof HTMLElement ? fullscreenElement : null;
    this.videoStyles = saveProperties(video.style, VIDEO_PROPERTIES);
    if (this.container) this.containerStyles = saveProperties(this.container.style, CONTAINER_PROPERTIES);
    this.observeVideoStyle(video);
  }

  private observeVideoStyle(video: HTMLVideoElement): void {
    if (typeof MutationObserver !== 'function') return;
    this.videoStyleObserver = new MutationObserver(() => this.enforceAppliedStyles());
    this.videoStyleObserver.observe(video, { attributes: true, attributeFilter: ['style'] });
  }

  private enforceAppliedStyles(): void {
    if (!this.video || !this.appliedTransform) return;
    const setImportant = (property: string, value: string): void => {
      if (
        this.video!.style.getPropertyValue(property) !== value
        || this.video!.style.getPropertyPriority(property) !== 'important'
      ) this.video!.style.setProperty(property, value, 'important');
    };

    setImportant('transform-origin', '0 0');
    setImportant('transition', this.appliedTransition);
    setImportant('transform', this.appliedTransform);
    setImportant('will-change', 'transform');
    if (
      this.container
      && (
        this.container.style.getPropertyValue('overflow') !== 'hidden'
        || this.container.style.getPropertyPriority('overflow') !== 'important'
      )
    ) this.container.style.setProperty('overflow', 'hidden', 'important');
  }

  private restoreSavedValues(): void {
    if (this.video) restoreProperties(this.video.style, this.videoStyles);
    if (this.container) restoreProperties(this.container.style, this.containerStyles);
  }
}
