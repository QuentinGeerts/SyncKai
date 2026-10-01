const SVG_NS = 'http://www.w3.org/2000/svg';

// Tracés en style "stroke" (viewBox 24x24), inspirés de Lucide
const ICON_PATHS = {
  spinner: ['M21 12a9 9 0 1 1-6.219-8.56'],
  external: ['M15 3h6v6', 'M10 14 21 3', 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'],
  alert: ['M22 12a10 10 0 1 1-20 0a10 10 0 1 1 20 0', 'M12 8v4', 'M12 16h.01'],
  check: ['M5 12.5 10 17.5 19 7'],
  search: ['M19 11a8 8 0 1 1-16 0a8 8 0 1 1 16 0', 'm21 21-4.3-4.3'],
  trash: ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'],
  gear: [
    'M15 12a3 3 0 1 1-6 0a3 3 0 1 1 6 0',
    'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  ],
  back: ['M19 12H5', 'M11 6 5 12l6 6'],
  chevronDown: ['M6 9l6 6 6-6'],
  chevronRight: ['M9 6l6 6-6 6'],
  sortNext: ['M7 4v16', 'M3 16l4 4 4-4', 'M14 6h7', 'M14 12h5', 'M14 18h3'],
  screen: ['M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M8 21h8'],
  // Points de suspension : segments nuls rendus en disques par stroke-linecap="round"
  more: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
  ban: ['M22 12a10 10 0 1 1-20 0a10 10 0 1 1 20 0', 'm4.9 4.9 14.2 14.2'],
  minus: ['M5 12h14'],
  retry: ['M3 12a9 9 0 1 0 3-6.7L3 8', 'M3 3v5h5'],
  clock: ['M22 12a10 10 0 1 1-20 0a10 10 0 1 1 20 0', 'M12 7v5l3 2'],
  star: ['M12 2.6l2.85 5.95 6.55.85-4.8 4.55 1.25 6.5L12 17.3l-5.85 3.15 1.25-6.5-4.8-4.55 6.55-.85z'],
} as const;

export type IconName = keyof typeof ICON_PATHS;

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  return el;
}

export function icon(name: IconName, className = 'h-4 w-4', strokeWidth = '2'): SVGSVGElement {
  const svg = svgEl('svg', {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': strokeWidth,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    class: `shrink-0 ${className}`,
  });
  for (const d of ICON_PATHS[name]) svg.append(svgEl('path', { d }));
  // Petit triangle "lecture" plein à l'intérieur de l'écran
  if (name === 'screen') svg.append(svgEl('path', { d: 'M10 8l5 2.5-5 2.5z', fill: 'currentColor' }));
  return svg;
}

/** Triangle d'avertissement plein (couleur via currentColor, point d'exclamation sombre) */
export function warnIcon(className = 'h-3.5 w-3.5'): SVGSVGElement {
  const svg = svgEl('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', class: `shrink-0 ${className}` });
  svg.append(
    svgEl('path', { d: 'M12 3 22 20H2Z', fill: 'currentColor', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linejoin': 'round' }),
    svgEl('path', { d: 'M12 10v4', stroke: '#1A0F1C', 'stroke-width': '2.4', 'stroke-linecap': 'round' }),
    svgEl('circle', { cx: '12', cy: '17', r: '1.3', fill: '#1A0F1C' }),
  );
  return svg;
}

/** Triangle "lecture" plein */
export function playIcon(className = 'h-3 w-3'): SVGSVGElement {
  const svg = svgEl('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', class: `shrink-0 ${className}` });
  svg.append(svgEl('path', { d: 'M7 4.5 19.5 12 7 19.5Z', fill: 'currentColor', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linejoin': 'round' }));
  return svg;
}

/** Étincelle beurre posée sur la barre de progression de la carte « Reprendre » */
export function sparkIcon(className: string): SVGSVGElement {
  const svg = svgEl('svg', { viewBox: '0 0 10 10', 'aria-hidden': 'true', class: className });
  svg.append(svgEl('path', { d: 'M5 0 6.2 3.8 10 5 6.2 6.2 5 10 3.8 6.2 0 5 3.8 3.8Z', fill: '#FFD37A' }));
  return svg;
}

export type MochiMood = 'awake' | 'sleeping';

/**
 * Mascotte Mochi (viewBox 24). `squish` anime le corps (désactivé si l'utilisateur
 * préfère réduire les animations, via motion-safe).
 */
export function mochi(className: string, mood: MochiMood = 'awake', squish = false): SVGSVGElement {
  const svg = svgEl('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', class: `shrink-0 overflow-visible ${className}` });
  const body = svgEl('g', squish ? { class: 'origin-[12px_23px] motion-safe:animate-squish' } : {});
  body.append(
    svgEl('path', { d: 'M13 8C13 5 15 4 17 3', fill: 'none', stroke: '#F4EFFA', 'stroke-width': '1.2', 'stroke-linecap': 'round' }),
    svgEl('path', { d: 'M17.5.6 18.2 2.3 19.9 3 18.2 3.7 17.5 5.4 16.8 3.7 15.1 3 16.8 2.3Z', fill: '#FFD37A' }),
    svgEl('ellipse', { cx: '12', cy: '15', rx: '10', ry: '8', fill: '#FFFFFF' }),
  );
  if (mood === 'sleeping') {
    body.append(
      svgEl('path', { d: 'M7.4 14.2Q8.6 15.5 9.8 14.2', fill: 'none', stroke: '#1A0F1C', 'stroke-width': '0.9', 'stroke-linecap': 'round' }),
      svgEl('path', { d: 'M14.2 14.2Q15.4 15.5 16.6 14.2', fill: 'none', stroke: '#1A0F1C', 'stroke-width': '0.9', 'stroke-linecap': 'round' }),
    );
  } else {
    body.append(
      svgEl('circle', { cx: '8.6', cy: '14.4', r: '1.2', fill: '#1A0F1C' }),
      svgEl('circle', { cx: '15.4', cy: '14.4', r: '1.2', fill: '#1A0F1C' }),
    );
  }
  body.append(
    svgEl('ellipse', { cx: '6.4', cy: '17', rx: '1.8', ry: '1.1', fill: '#FF8FB8' }),
    svgEl('ellipse', { cx: '17.6', cy: '17', rx: '1.8', ry: '1.1', fill: '#FF8FB8' }),
  );
  svg.append(body);
  if (mood === 'sleeping') {
    const z1 = svgEl('text', { x: '1', y: '7', fill: '#B9A4FF', 'font-weight': '800', 'font-size': '4', class: 'font-display' });
    z1.textContent = 'z';
    const z2 = svgEl('text', { x: '4.2', y: '3.6', fill: '#B9A4FF', 'font-weight': '800', 'font-size': '3', opacity: '0.75', class: 'font-display' });
    z2.textContent = 'z';
    svg.append(z1, z2);
  }
  return svg;
}
