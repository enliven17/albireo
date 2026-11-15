import { createHash, randomBytes } from 'node:crypto'

// Visitor identity without storing anything personal: a hash of site, IP and user agent
// with a salt that rotates every UTC day. Old salts are forgotten, so a visitor cannot be
// linked across days and the IP never leaves memory.

export class DailySalt {
  private day = ''
  private salt: Buffer = Buffer.alloc(0)
  private source: () => Buffer
  constructor(source: () => Buffer = () => randomBytes(32)) { this.source = source }
  current(now = Date.now()) {
    const day = new Date(now).toISOString().slice(0, 10)
    if (day !== this.day) {
      this.day = day
      this.salt = this.source()
    }
    return this.salt
  }
}

export function visitorId(salt: Buffer, siteId: string, ip: string, userAgent: string) {
  return createHash('sha256').update(salt).update(siteId).update('\0').update(ip).update('\0').update(userAgent).digest('hex').slice(0, 32)
}
