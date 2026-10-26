// Semester brand palette (Graphite and Brass): the hex values semester-brand.css was generated from.
// Read from harrisonjrubin7-cmyk/semester app/src/lib/look.ts (Parchment and Ink grounds, Brass accent) via the brand kit.
// `dim` on Parchment is the kit's rgba(27,26,23,.72) blended onto the ground.
// Deviation, recorded: the Ink warning ink is lifted from #cb7b62 to #d5937f, so the attention ink holds 4.6:1 on every dark
// surface (brand kit, --status-attention).
export const PARCHMENT = { bg: '#f4f1ea', soft: '#fbf9f4', surface: '#ffffff', s2: '#e8e4dc', ink: '#1b1a17', dim: '#585652', accent: '#695a33', on: '#fbf9f4', warn: '#9a4a32', ok: '#3d6b4a' } as const;
export const INK = { bg: '#16181c', soft: '#1f2229', surface: '#282c34', s2: '#333843', ink: '#eceef2', dim: '#b4b7bf', accent: '#d8c79a', on: '#0e0f12', warn: '#d5937f', ok: '#a9c7b0' } as const;
/** The workspace rail's action surface: dark ink only. White text on it is below 4.5:1, so it is never used. */
export const WORKSPACE_ACTION = { fill: '#e87441', strong: '#d9612e', ink: '#0b2022' } as const;

/** WCAG 2 relative luminance contrast ratio for two #rrggbb colours. */
export function contrast(a: string, b: string): number {
  const lum = (h: string) => {
    const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
