// Negative control: excluded from the normal lint command and inspected by guardrails.mjs.
async function ignored(): Promise<number> {
  return await Promise.resolve(1)
}
ignored()
void ignored()
