// Generate readable JSON (also valid YAML) for independent Collector comparisons.
import { mkdir, writeFile } from 'node:fs/promises'

export async function configs(directory) {
  const base = () => ({
    extensions: {
      file_storage: { directory: '/var/lib/otelcol/lab', create_directory: true, fsync: true },
      health_check: { endpoint: '0.0.0.0:13133' },
    },
    receivers: { otlp: { protocols: { http: { endpoint: '0.0.0.0:4318' } } } },
    exporters: { otlp_http: {
      endpoint: 'http://sink:4320', encoding: 'json', compression: 'none', timeout: '2s',
      sending_queue: { enabled: true, num_consumers: 1, queue_size: 1000, storage: 'file_storage' },
      retry_on_failure: { enabled: true, initial_interval: '1s', max_interval: '2s', max_elapsed_time: '0s' },
    } },
    service: {
      extensions: ['file_storage', 'health_check'],
      pipelines: { metrics: { receivers: ['otlp'], exporters: ['otlp_http'] } },
      telemetry: { logs: { level: 'info' } },
    },
  })
  const variants = {}
  const auth = variants.auth = base()
  auth.extensions.oidc = { providers: [{ issuer_url: 'http://sink:4320/issuer', audience: 'stellarcope-lab' }] }
  auth.service.extensions.push('oidc')
  auth.receivers.otlp.protocols.http.auth = { authenticator: 'oidc' }
  // Overwrite caller-provided attribution BEFORE persistence. Do not copy tokens.
  auth.processors = { transform: { error_mode: 'propagate', metric_statements: [{ context: 'resource', statements: [
    'set(resource.attributes["tenant.id"], otelcol.client.auth.attributes["claims.tenant_id"])',
    'keep_keys(resource.attributes, ["service.name", "service.instance.id", "tenant.id"])',
  ] }, { context: 'datapoint', statements: [
    'keep_keys(datapoint.attributes, ["http.route", "http.response.status_code", "lab.case"])',
  ] }] } }
  auth.service.pipelines.metrics.processors = ['transform']
  const batch = variants['queue-batch'] = base()
  batch.exporters.otlp_http.sending_queue.batch = { min_size: 100, flush_timeout: '30s' }
  const old = variants['processor-batch'] = base()
  old.processors = { batch: { send_batch_size: 100, timeout: '30s' } }
  old.service.pipelines.metrics.processors = ['batch']
  const tiny = variants.tiny = base()
  tiny.exporters.otlp_http.sending_queue.queue_size = 2
  const finite = variants.finite = base()
  finite.exporters.otlp_http.retry_on_failure.max_elapsed_time = '3s'
  const cumulative = variants.cumulative = base()
  cumulative.processors = { cumulative_to_delta: { initial_value: 'keep' } }
  cumulative.service.pipelines.metrics.processors = ['cumulative_to_delta']
  variants.plain = base()
  await mkdir(`${directory}generated`, { recursive: true })
  for (const [name, config] of Object.entries(variants)) {
    await writeFile(`${directory}generated/${name}.yaml`, `${JSON.stringify(config, null, 2)}\n`)
  }
  return variants
}
