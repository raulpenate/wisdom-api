export const PALETTES = {
  teal: "turquoise",
  blue: "blue",
  purple: "lilac",
  pink: "pink",
  red: "red",
  orange: "orange",
  yellow: "yellow",
  green: "green",
  graphite: "gray",
} as const;

export type PaletteId = keyof typeof PALETTES;

export const PALETTE_IDS = Object.keys(PALETTES) as PaletteId[];

export const DEFAULT_PALETTE: PaletteId = "teal";

export function parsePalette(raw: string | undefined): PaletteId | null {
  if (raw === undefined) return DEFAULT_PALETTE;
  return Object.hasOwn(PALETTES, raw) ? (raw as PaletteId) : null;
}
