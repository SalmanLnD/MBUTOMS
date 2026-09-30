// Fixed-position overlays must fit the visible viewport, including the mobile keyboard.
export function getPopoverPosition(rect, viewport, { minWidth = 180, preferredHeight = 280, alignRight = false } = {}) {
  const padding = 8;
  const gap = 6;
  const x = viewport.offsetLeft || 0;
  const y = viewport.offsetTop || 0;
  const right = x + viewport.width - padding;
  const bottom = y + viewport.height - padding;
  const width = Math.max(0, Math.min(Math.max(rect.width, minWidth), viewport.width - padding * 2));
  const above = Math.max(0, Math.min(rect.top - gap, bottom) - y - padding);
  const below = Math.max(0, bottom - Math.max(rect.bottom + gap, y + padding));
  const openUp = below < Math.min(180, preferredHeight) && above > below;
  const top = openUp ? Math.min(bottom, Math.max(y + padding, rect.top - gap)) : Math.max(y + padding, Math.min(bottom, rect.bottom + gap));
  return {
    top,
    left: Math.max(x + padding, Math.min(alignRight ? rect.right - width : rect.left, right - width)),
    width,
    maxHeight: Math.min(preferredHeight, openUp ? above : below),
    transform: openUp ? 'translateY(-100%)' : 'none',
  };
}

export function visibleViewport() {
  return window.visualViewport || { width: window.innerWidth, height: window.innerHeight };
}
