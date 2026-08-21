export function toolbarIconPaths(enabled: boolean): Record<number, string> {
  const prefix = enabled ? 'icon' : 'icon-disabled';
  return {
    16: `icon/${prefix}-16.png`,
    32: `icon/${prefix}-32.png`,
    48: `icon/${prefix}-48.png`,
    128: `icon/${prefix}-128.png`,
  };
}
