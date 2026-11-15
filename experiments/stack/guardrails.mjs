import { ESLint } from 'eslint'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
const eslint = new ESLint()
const [result] = await eslint.lintFiles(['src/lint-negative.ts'])
assert.equal(result.messages.filter((m) => m.ruleId === '@typescript-eslint/no-floating-promises').length, 2)
for (const flag of ['noUncheckedIndexedAccess', 'exactOptionalPropertyTypes']) {
  let output = ''
  try { execFileSync('./node_modules/.bin/tsc', ['--noEmit', `--${flag}`, 'false'], { encoding: 'utf8' }); assert.fail(`${flag} negative control did not fail`) }
  catch (error) { output = error.stdout ?? ''; assert.match(output, /Unused '@ts-expect-error' directive/) }
}
console.log(JSON.stringify({ status: 'passed', floatingPromisesCaught: 2, compilerFlagsVerified: ['noUncheckedIndexedAccess', 'exactOptionalPropertyTypes'] }))
