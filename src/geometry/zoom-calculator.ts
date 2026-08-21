import type { Box, NormalizedRect } from '../core/types';

export type SupportedObjectFit = 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';

export interface ZoomInput {
  element: Box;
  viewport: Box;
  intrinsicWidth: number;
  intrinsicHeight: number;
  content: NormalizedRect;
  objectFit: SupportedObjectFit;
}

export interface ZoomTransform {
  scale: number;
  translateX: number;
  translateY: number;
  mode: 'contain';
}

function fittedMediaBox(input: ZoomInput): Box {
  const intrinsicAspect = input.intrinsicWidth / input.intrinsicHeight;
  const boxAspect = input.element.width / input.element.height;

  if (input.objectFit === 'fill') return { left: 0, top: 0, width: input.element.width, height: input.element.height };

  let containWidth: number;
  let containHeight: number;
  if (intrinsicAspect > boxAspect) {
    containWidth = input.element.width;
    containHeight = containWidth / intrinsicAspect;
  } else {
    containHeight = input.element.height;
    containWidth = containHeight * intrinsicAspect;
  }

  let width = containWidth;
  let height = containHeight;
  if (input.objectFit === 'cover') {
    const coverScale = Math.max(input.element.width / containWidth, input.element.height / containHeight);
    width *= coverScale;
    height *= coverScale;
  } else if (input.objectFit === 'none') {
    width = input.intrinsicWidth;
    height = input.intrinsicHeight;
  } else if (input.objectFit === 'scale-down') {
    width = Math.min(input.intrinsicWidth, containWidth);
    height = width / intrinsicAspect;
    if (height > containHeight) {
      height = containHeight;
      width = height * intrinsicAspect;
    }
  }

  return {
    left: (input.element.width - width) / 2,
    top: (input.element.height - height) / 2,
    width,
    height,
  };
}

export function calculateZoom(input: ZoomInput): ZoomTransform | null {
  if (
    input.element.width <= 0
    || input.element.height <= 0
    || input.viewport.width <= 0
    || input.viewport.height <= 0
    || input.intrinsicWidth <= 0
    || input.intrinsicHeight <= 0
  ) return null;

  const media = fittedMediaBox(input);
  const contentWidth = media.width * (input.content.right - input.content.left);
  const contentHeight = media.height * (input.content.bottom - input.content.top);
  if (contentWidth <= 0 || contentHeight <= 0) return null;

  // Scale the detected picture as large as possible without cropping any real
  // content. Only the encoded bars outside `content` are allowed to overflow.
  // The host player may briefly report an oversized video element while
  // switching sources (YouTube autoplay does this). Smart Ultrawide only
  // removes bars by zooming in, so reject transient shrink measurements.
  const scale = Math.min(input.viewport.width / contentWidth, input.viewport.height / contentHeight);
  if (scale < 1) return null;

  const contentLeft = media.left + media.width * input.content.left;
  const contentTop = media.top + media.height * input.content.top;
  const transformedWidth = contentWidth * scale;
  const transformedHeight = contentHeight * scale;
  const targetLeft = input.viewport.left + (input.viewport.width - transformedWidth) / 2;
  const targetTop = input.viewport.top + (input.viewport.height - transformedHeight) / 2;

  return {
    scale,
    translateX: targetLeft - input.element.left - contentLeft * scale,
    translateY: targetTop - input.element.top - contentTop * scale,
    mode: 'contain',
  };
}
