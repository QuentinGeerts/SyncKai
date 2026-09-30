const SVG_NS = 'http://www.w3.org/2000/svg';

// Tracés en style "stroke" (viewBox 24x24), inspirés de Lucide
const ICON_PATHS = {
  spinner: ['M21 12a9 9 0 1 1-6.219-8.56'],
  external: ['M15 3h6v6', 'M10 14 21 3', 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'],
  alert: ['M22 12a10 10 0 1 1-20 0a10 10 0 1 1 20 0', 'M12 8v4', 'M12 16h.01'],
  check: ['M20 6 9 17l-5-5'],
  search: ['M19 11a8 8 0 1 1-16 0a8 8 0 1 1 16 0', 'm21 21-4.3-4.3'],
  sliders: ['M21 4h-7', 'M10 4H3', 'M21 12h-9', 'M8 12H3', 'M21 20h-5', 'M12 20H3', 'M14 2v4', 'M8 10v4', 'M16 18v4'],
  trash: ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'm16 17 5-5-5-5', 'M21 12H9'],
} as const;

export type IconName = keyof typeof ICON_PATHS;

export function icon(name: IconName, className = 'h-4 w-4'): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  const attrs: Record<string, string> = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    class: `shrink-0 ${className}`,
  };
  for (const [key, value] of Object.entries(attrs)) svg.setAttribute(key, value);

  for (const d of ICON_PATHS[name]) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}
