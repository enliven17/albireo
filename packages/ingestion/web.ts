import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'

// The end assertion also rejects a trailing newline, unlike JavaScript's `$`.
export const IdentifierSchema = Type.String({
  minLength: 1,
  maxLength: 64,
  pattern: '^[A-Za-z0-9_-]+(?![\\s\\S])',
})

export const EventIdSchema = Type.String({
  minLength: 36,
  maxLength: 36,
  pattern:
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?![\\s\\S])',
})

const common = {
  version: Type.Literal(1),
  siteId: IdentifierSchema,
  eventId: EventIdSchema,
  path: Type.String({
    minLength: 1,
    maxLength: 256,
    pattern: '^/(?!/)[^?#\\s\\x00-\\x1f\\x7f-\\x9f]*(?![\\s\\S])',
  }),
}

export const WebEventV1Schema = Type.Union([
  Type.Object({ ...common, type: Type.Literal('pageview') }, { additionalProperties: false }),
  Type.Object(
    {
      ...common,
      type: Type.Literal('event'),
      name: Type.String({
        minLength: 1,
        maxLength: 64,
        pattern: '^[A-Za-z][A-Za-z0-9_.:-]*(?![\\s\\S])',
      }),
    },
    { additionalProperties: false },
  ),
])

export type WebEventV1 = Static<typeof WebEventV1Schema>
const validator = Compile(WebEventV1Schema)

/** Structural validation only. Admission must still resolve authority and apply privacy policy. */
export function parseWebEvent(input: unknown): WebEventV1 | null {
  return validator.Check(input) ? input : null
}
