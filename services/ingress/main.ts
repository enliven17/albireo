import { createIngressApps } from './app.ts'
import type { AppOptions } from './app.ts'
import { loadConfig, type IngressConfig } from './config.ts'

export type RunningIngress = ReturnType<typeof createIngressApps> & { close(): Promise<void> }
export async function startIngress(
  config: IngressConfig,
  options: AppOptions = {},
): Promise<RunningIngress> {
  const apps = createIngressApps(config, options)
  let closing: Promise<void> | undefined
  function close(): Promise<void> {
    closing ??= Promise.all([apps.publicApp.close(), apps.privateApp.close()]).then(() => {})
    return closing
  }
  try {
    await apps.privateApp.listen({ host: config.privateHost, port: config.privatePort })
    await apps.publicApp.listen({ host: config.publicHost, port: config.publicPort })
    return { ...apps, close }
  } catch (error) {
    await Promise.allSettled([apps.publicApp.close(), apps.privateApp.close()])
    throw error
  }
}

if (import.meta.main) {
  try {
    const service = await startIngress(loadConfig(process.env))
    let stopping = false
    const stop = () => {
      if (stopping) return
      stopping = true
      const deadline = setTimeout(() => {
        console.error('Ingress shutdown timed out')
        process.exit(1)
      }, 10000)
      deadline.unref()
      service.close().then(
        () => {
          clearTimeout(deadline)
          process.exitCode = 0
        },
        () => {
          console.error('Ingress shutdown failed')
          process.exit(1)
        },
      )
    }
    process.once('SIGTERM', stop)
    process.once('SIGINT', stop)
    service.publicApp.log.info('Ingress listeners started')
  } catch {
    console.error('Ingress startup failed')
    process.exitCode = 1
  }
}
