import { isIP } from 'node:net'

const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'] as const

export type IngressConfig = Readonly<{
  publicHost: string
  publicPort: number
  privateHost: string
  privatePort: number
  publicBodyLimit: number
  privateBodyLimit: number
  logLevel: (typeof LOG_LEVELS)[number]
}>

function number(env: NodeJS.ProcessEnv, key: string, fallback: number, max: number): number {
  const raw = env[key]
  if (raw === undefined) return fallback
  const parsed = Number(raw)
  if (!/^[1-9][0-9]*$/.test(raw) || !Number.isSafeInteger(parsed) || parsed > max) {
    throw new Error(`Invalid ${key}`)
  }
  return parsed
}

function host(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key] ?? '127.0.0.1'
  if (!isIP(value)) throw new Error(`Invalid ${key}`)
  return value
}

export function loadConfig(env: NodeJS.ProcessEnv): IngressConfig {
  const publicPort = number(env, 'INGRESS_PUBLIC_PORT', 8080, 65535)
  const privatePort = number(env, 'INGRESS_PRIVATE_PORT', 8081, 65535)
  if (publicPort === privatePort)
    throw new Error('INGRESS_PRIVATE_PORT must differ from INGRESS_PUBLIC_PORT')
  const logLevel = LOG_LEVELS.find((level) => level === (env.INGRESS_LOG_LEVEL ?? 'info'))
  if (!logLevel) throw new Error('Invalid INGRESS_LOG_LEVEL')
  return {
    publicHost: host(env, 'INGRESS_PUBLIC_HOST'),
    publicPort,
    privateHost: host(env, 'INGRESS_PRIVATE_HOST'),
    privatePort,
    publicBodyLimit: number(env, 'INGRESS_PUBLIC_BODY_LIMIT_BYTES', 8192, 8192),
    privateBodyLimit: number(env, 'INGRESS_PRIVATE_BODY_LIMIT_BYTES', 4194304, 4194304),
    logLevel,
  }
}
