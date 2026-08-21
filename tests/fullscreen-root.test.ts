// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { findFullscreenRoot } from '../src/dom/fullscreen-root';

afterEach(() => document.body.replaceChildren());

describe('findFullscreenRoot', () => {
  it('recognizes YouTube fullscreen state in Chromium variants', () => {
    const player = document.createElement('div');
    player.className = 'html5-video-player ytp-fullscreen';
    document.body.append(player);
    expect(findFullscreenRoot()).toBe(player);
  });

  it('does not treat YouTube theater mode as fullscreen', () => {
    const player = document.createElement('div');
    player.className = 'html5-video-player ytp-big-mode';
    document.body.append(player);
    expect(findFullscreenRoot()).toBeNull();
  });
});
