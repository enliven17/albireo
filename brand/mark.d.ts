export const MARK: { size: number; a: [number, number][]; b: [number, number][] }
export const COLORS: Record<'space' | 'panel' | 'ink' | 'mute' | 'gold' | 'blue', string>
export function cellsToPath(cells: [number, number][]): string
export const GLYPHS: Record<string, string[]>
export function wordPath(text: string, x0?: number, y0?: number, unit?: number): string
