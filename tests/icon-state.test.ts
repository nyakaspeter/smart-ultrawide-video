import { describe, expect, it } from 'vitest';
import { toolbarIconPaths } from '../src/core/icon-state';

describe('toolbarIconPaths', () => {
  it('uses colored icons while enabled', () => {
    expect(toolbarIconPaths(true)[16]).toBe('icon/icon-16.png');
    expect(toolbarIconPaths(true)[128]).toBe('icon/icon-128.png');
  });

  it('uses grey icons while disabled', () => {
    expect(toolbarIconPaths(false)[16]).toBe('icon/icon-disabled-16.png');
    expect(toolbarIconPaths(false)[128]).toBe('icon/icon-disabled-128.png');
  });
});
