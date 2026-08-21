import type { Box, DetectedFrame } from '../core/types';
import { DEFAULT_ZOOM_TOLERANCE_PERCENT } from '../core/settings';
import { ZOOM_OUT_CONFIRMATION_MS } from '../core/constants';
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
  private pendingZoomOutSince: number | null = null;
  private zoomToleranceRatio = DEFAULT_ZOOM_TOLERANCE_PERCENT / 100;
  private videoStyleObserver: MutationObserver | null = null;
  private entryConcealed = false;

  constructor(private readonly now: () => number = () => performance.now()) {}

  setZoomTolerancePercent(percent: number): void {
    this.zoomToleranceRatio = Math.max(0, percent) / 100;
  }

  rejectFrame(): void {
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
    });
    if (!transform || !Number.isFinite(transform.scale) || transform.scale < 1) {
      this.enforceAppliedStyles();
      return null;
    }

    const previousZoom = this.appliedZoom;
    const zoomDeltaRatio = previousZoom === null
      ? Number.POSITIVE_INFINITY
      : Math.abs(transform.scale / previousZoom - 1);
    const exceedsTolerance = zoomDeltaRatio > this.zoomToleranceRatio;
    let changed = force || previousZoom === null;

    if (force || previousZoom === null || !exceedsTolerance || transform.scale >= previousZoom) {
      this.pendingZoomOutSince = null;
      if (!changed && exceedsTolerance && transform.scale > previousZoom!) changed = true;
    } else {
      const now = this.now();
      this.pendingZoomOutSince ??= now;
      changed = now - this.pendingZoomOutSince >= ZOOM_OUT_CONFIRMATION_MS;
      if (changed) this.pendingZoomOutSince = null;
    }
    const zoomChanged = previousZoom === null
      || (changed && transform.scale !== previousZoom);

    if (changed) {
      this.appliedZoom = transform.scale;
      this.appliedTransform = `translate3d(${transform.translateX}px, ${transform.translateY}px, 0) scale(${transform.scale})`;
      this.appliedTransition = zoomChanged && previousZoom !== null && !force
        ? ZOOM_TRANSITION
        : 'none';
    }

    this.enforceAppliedStyles();
    return {
      previousZoom,
      appliedZoom: this.appliedZoom!,
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
    this.pendingZoomOutSince = null;
    this.entryConcealed = false;
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
