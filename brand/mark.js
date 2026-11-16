// Stellarcope mark: two pixel stars on a 16 unit grid. The large one is gold (web),
// the small one blue (API). Shared by the site and the brand kit generator.
const star = (cx, cy, core, arm, diag) => {
  const cells = []
  for (let y = -core; y <= core; y++) for (let x = -core; x <= core; x++) cells.push([cx + x, cy + y])
  for (let i = core + 1; i <= core + arm; i++) cells.push([cx + i, cy], [cx - i, cy], [cx, cy + i], [cx, cy - i])
  if (diag) for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) cells.push([cx + dx * (core + 1), cy + dy * (core + 1)])
  return cells
}

export const MARK = {
  size: 16,
  a: star(5, 5, 1, 3, true),
  b: star(12, 12, 0, 2, false),
}

export const COLORS = {
  space: '#05060A',
  panel: '#0B0D14',
  ink: '#ECEAE4',
  mute: '#8B90A0',
  gold: '#FFA630',
  blue: '#6E9BFF',
}

export const cellsToPath = (cells) => cells.map(([x, y]) => `M${x} ${y}h1v1h-1z`).join('')

// 5 x 7 pixel letters for the wordmark, one row per string
export const GLYPHS = {
  a: ['.....', '.....', '.###.', '....#', '.####', '#...#', '.####'],
  l: ['.##..', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  b: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '####.'],
  i: ['..#..', '.....', '.##..', '..#..', '..#..', '..#..', '.###.'],
  r: ['.....', '.....', '#.##.', '##..#', '#....', '#....', '#....'],
  e: ['.....', '.....', '.###.', '#...#', '#####', '#....', '.###.'],
  o: ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.'],
  s: ['.....', '.....', '.####', '#....', '.###.', '....#', '####.'],
  t: ['.#...', '.#...', '####.', '.#...', '.#...', '.#..#', '..##.'],
  c: ['.....', '.....', '.###.', '#....', '#....', '#...#', '.###.'],
  p: ['.....', '.....', '####.', '#...#', '####.', '#....', '#....'],
}

/** wordmark path, letters on a 6 cell advance, each cell `unit` wide, origin at x0 y0 */
export const wordPath = (text, x0 = 0, y0 = 0, unit = 1) => {
  const u = unit * 1.02
  const out = []
  ;[...text].forEach((ch, n) => GLYPHS[ch].forEach((row, y) => [...row].forEach((c, x) => {
    if (c === '#') out.push(`M${x0 + (n * 6 + x) * unit} ${y0 + y * unit}h${u}v${u}h-${u}z`)
  })))
  return out.join('')
}
