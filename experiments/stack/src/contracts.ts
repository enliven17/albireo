import { Type, type Static } from '@fastify/type-provider-typebox'

export const Event = Type.Object(
  {
    eventId: Type.String({ format: 'uuid' }),
    path: Type.String({ minLength: 1, maxLength: 256, pattern: '^/[^?#]*$' }),
    name: Type.String({ minLength: 1, maxLength: 64 }),
  },
  { additionalProperties: false },
)

export const Receipt = Type.Object(
  { accepted: Type.Literal(true), eventId: Type.String({ format: 'uuid' }) },
  { additionalProperties: false },
)
export const Failure = Type.Object({ error: Type.String() }, { additionalProperties: false })
export type WebEvent = Static<typeof Event>
export type Admission = { tenant: string; event: WebEvent }

// Negative controls: these must remain compiler errors under the selected flags.
const list: string[] = []
// @ts-expect-error indexed reads can be undefined
const unsafeIndex: string = list[0]
type Optional = { name?: string }
// @ts-expect-error absence and explicit undefined are distinct
const unsafeOptional: Optional = { name: undefined }
void unsafeIndex
void unsafeOptional
