import { appendFile, mkdir, readdir, readFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'

// Durable buffer between the collector and the database: newline delimited JSON, one file
// per minute. The collector only appends; the writer drains files whose minute has closed.
// A database outage just lets files pile up, no event is lost.
// ponytail: single node spool; NATS JetStream with 3 replicas is the upgrade for multi node HA

export type Record =
  | { kind: 'event'; site: string; tenant: string; ts: string; data: unknown }
  | { kind: 'drop'; site: string; day: string; reason: string }
  | { kind: 'api'; tenant: string; data: unknown }

const minuteOf = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace(/[-:T]/g, '')

export class Spool {
  private dir: string
  private buffer: string[] = []
  private timer: NodeJS.Timeout | null = null
  private ready: Promise<unknown>
  constructor(dir: string) {
    this.dir = dir
    this.ready = mkdir(dir, { recursive: true })
  }

  push(r: Record) {
    this.buffer.push(JSON.stringify(r))
    this.timer ??= setTimeout(() => void this.flush(), 200)
  }

  /** writes the buffer to the current minute file */
  async flush(now = Date.now()) {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    if (!this.buffer.length) return
    const lines = this.buffer.splice(0)
    await this.ready
    await appendFile(join(this.dir, `${minuteOf(now)}.ndjson`), `${lines.join('\n')}\n`)
  }

  /** files whose minute is over, oldest first */
  async closed(now = Date.now()) {
    await this.ready
    const current = `${minuteOf(now)}.ndjson`
    return (await readdir(this.dir)).filter((f) => f.endsWith('.ndjson') && f < current).sort()
  }

  async read(file: string): Promise<Record[]> {
    const text = await readFile(join(this.dir, file), 'utf8')
    return text.split('\n').filter(Boolean).flatMap((l) => {
      try { return [JSON.parse(l) as Record] } catch { return [] }
    })
  }

  remove(file: string) {
    return unlink(join(this.dir, file))
  }
}
