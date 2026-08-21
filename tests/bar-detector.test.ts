import { describe, expect, it } from 'vitest';
import { detectContentRect } from '../src/analysis/bar-detector';
import { fillRect, solidFrame } from './helpers/frames';

describe('detectContentRect', () => {
  it('keeps a normally filled frame unchanged', () => {
    const result = detectContentRect(solidFrame(160, 90));
    expect(result.isBlackFrame).toBe(false);
    expect(result.content).toEqual({ left: 0, top: 0, right: 1, bottom: 1 });
  });

  it('detects baked-in letterboxing', () => {
    const frame = solidFrame(160, 90, 3);
    fillRect(frame, 0, 12, 160, 78, 180);
    const result = detectContentRect(frame);
    expect(result.content.top).toBeCloseTo(12 / 90, 2);
    expect(result.content.bottom).toBeCloseTo(78 / 90, 2);
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('detects baked-in pillarboxing', () => {
    const frame = solidFrame(160, 90, 2);
    fillRect(frame, 34, 0, 126, 90, 200);
    const result = detectContentRect(frame);
    expect(result.content.left).toBeCloseTo(34 / 160, 2);
    expect(result.content.right).toBeCloseTo(126 / 160, 2);
  });

  it('detects four-sided windowboxing', () => {
    const frame = solidFrame(160, 90, 1);
    fillRect(frame, 18, 10, 142, 80, 170);
    const result = detectContentRect(frame);
    expect(result.content.left).toBeCloseTo(18 / 160, 2);
    expect(result.content.top).toBeCloseTo(10 / 90, 2);
    expect(result.content.right).toBeCloseTo(142 / 160, 2);
    expect(result.content.bottom).toBeCloseTo(80 / 90, 2);
  });

  it('ignores a small subtitle-like bright patch inside a bar', () => {
    const frame = solidFrame(160, 90, 2);
    fillRect(frame, 0, 12, 160, 78, 150);
    fillRect(frame, 70, 80, 90, 84, 245);
    const result = detectContentRect(frame);
    expect(result.content.top).toBeCloseTo(12 / 90, 2);
    expect(result.content.bottom).toBeCloseTo(78 / 90, 2);
  });

  it('ignores a wide promotional overlay inside a horizontal bar', () => {
    const frame = solidFrame(160, 90, 2);
    fillRect(frame, 0, 12, 160, 78, 150);
    fillRect(frame, 8, 2, 50, 10, 245);

    const result = detectContentRect(frame);
    expect(result.content.top).toBeCloseTo(12 / 90, 2);
    expect(result.content.bottom).toBeCloseTo(78 / 90, 2);
    expect(result.confidence).toBeGreaterThan(0.45);
  });

  it('marks fully black frames as unsuitable', () => {
    const result = detectContentRect(solidFrame(160, 90, 2));
    expect(result.isBlackFrame).toBe(true);
    expect(result.confidence).toBe(0);
  });

  it('detects bars around genuinely dark footage', () => {
    const frame = solidFrame(160, 90, 3);
    fillRect(frame, 0, 12, 160, 78, 22);
    const result = detectContentRect(frame);
    expect(result.isBlackFrame).toBe(false);
    expect(result.content.top).toBeCloseTo(12 / 90, 2);
    expect(result.content.bottom).toBeCloseTo(78 / 90, 2);
    expect(result.confidence).toBeGreaterThan(0.45);
  });

  it('does not call a dark frame with sparse highlights black', () => {
    const frame = solidFrame(160, 90, 2);
    fillRect(frame, 0, 12, 160, 78, 8);
    fillRect(frame, 60, 30, 100, 55, 180);

    const result = detectContentRect(frame);
    expect(result.isBlackFrame).toBe(false);
  });

  it('accepts a sustained low-contrast edge around dark footage', () => {
    const frame = solidFrame(160, 90, 0);
    fillRect(frame, 0, 12, 160, 78, 4);
    fillRect(frame, 55, 30, 105, 55, 80);

    const result = detectContentRect(frame);
    expect(result.isBlackFrame).toBe(false);
    expect(result.content.top).toBeCloseTo(12 / 90, 2);
    expect(result.content.bottom).toBeCloseTo(78 / 90, 2);
    expect(result.confidence).toBeGreaterThan(0.45);
  });

  it('treats uniformly near-black edge content as ambiguous, not proof of no bars', () => {
    const result = detectContentRect(solidFrame(160, 90, 14));
    expect(result.isBlackFrame).toBe(false);
    expect(result.content).toEqual({ left: 0, top: 0, right: 1, bottom: 1 });
    expect(result.confidence).toBeLessThan(0.45);
  });

  it('rejects dark picture sides as false pillarboxing', () => {
    const frame = solidFrame(160, 90, 0);
    fillRect(frame, 0, 12, 160, 78, 8);
    // A bright central title creates an apparent vertical boundary, while a
    // planet crossing the full picture contaminates the supposed side bars.
    fillRect(frame, 36, 24, 124, 34, 200);
    fillRect(frame, 0, 72, 160, 78, 160);

    const result = detectContentRect(frame);
    expect(result.content.left).toBe(0);
    expect(result.content.right).toBe(1);
    expect(result.content.top).toBeCloseTo(12 / 90, 2);
    expect(result.content.bottom).toBeCloseTo(78 / 90, 2);
    expect(result.confidence).toBeGreaterThan(0.45);
  });

  it('stops at a dark gradient instead of absorbing it into letterbox bars', () => {
    const frame = solidFrame(160, 90, 0);
    for (let y = 12; y < 78; y += 1) {
      const distanceFromCenter = Math.abs(y - 45);
      const level = Math.max(7, 70 - distanceFromCenter * 2);
      fillRect(frame, 0, y, 160, y + 1, level);
    }

    const result = detectContentRect(frame);
    expect(result.content.top).toBeCloseTo(12 / 90, 2);
    expect(result.content.bottom).toBeCloseTo(78 / 90, 2);
    expect(result.confidence).toBeGreaterThan(0.45);
  });
});
