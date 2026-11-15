import { createHash } from 'node:crypto'
import { Type } from 'typebox'
import { Compile } from 'typebox/compile'
import { EventIdSchema, IdentifierSchema } from './web.ts'

const context = Compile(
  Type.Object(
    {
      tenantId: IdentifierSchema,
      siteId: IdentifierSchema,
      eventId: EventIdSchema,
    },
    { additionalProperties: false },
  ),
)

/** A scoped idempotency key, not authentication or a content fingerprint. */
export function webReceiptId(tenantId: string, siteId: string, eventId: string): string {
  if (!context.Check({ tenantId, siteId, eventId })) {
    throw new TypeError('Invalid web receipt context')
  }
  const tuple = JSON.stringify(['web', 1, tenantId, siteId, eventId.toLowerCase()])
  return createHash('sha256').update(tuple).digest('hex')
}
