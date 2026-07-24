export interface FetchRetryControl {
  timeoutMs?: number
  fetcher?: (url: string, options?: RequestInit) => Promise<Response>
}

const getAbortReason = (signal: AbortSignal) => (
  signal.reason ?? new DOMException('请求已取消', 'AbortError')
)

const waitWithSignal = <T>(promise: Promise<T>, signal: AbortSignal): Promise<T> => {
  if (signal.aborted) return Promise.reject(getAbortReason(signal))

  return new Promise<T>((resolve, reject) => {
    const handleAbort = () => reject(getAbortReason(signal))
    signal.addEventListener('abort', handleAbort, { once: true })
    promise.then(
      value => {
        signal.removeEventListener('abort', handleAbort)
        resolve(value)
      },
      error => {
        signal.removeEventListener('abort', handleAbort)
        reject(error)
      }
    )
  })
}

const waitForRetry = (delay: number, signal: AbortSignal) => waitWithSignal(
  new Promise<void>(resolve => setTimeout(resolve, delay)),
  signal
)

const hasResponseBody = (response: Response, method?: string) => (
  method?.toUpperCase() !== 'HEAD'
  && response.status !== 204
  && response.status !== 205
  && response.status !== 304
  && response.status !== 0
)

const materializeResponse = async (response: Response, method: string | undefined, signal: AbortSignal) => {
  if (!hasResponseBody(response, method)) return response
  const body = await waitWithSignal(response.arrayBuffer(), signal)
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  })
}

/**
 * Fetch with automatic retry on network errors and one timeout budget shared by all attempts.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 3,
  delay = 1000,
  control: FetchRetryControl = {}
): Promise<Response> {
  const callerSignal = options.signal
  const controller = new AbortController()
  const fetcher = control.fetcher ?? fetch
  let timedOut = false

  if (callerSignal?.aborted) throw getAbortReason(callerSignal)

  const handleCallerAbort = () => controller.abort(getAbortReason(callerSignal!))
  callerSignal?.addEventListener('abort', handleCallerAbort, { once: true })

  const timeoutId = typeof control.timeoutMs === 'number' && control.timeoutMs > 0
    ? setTimeout(() => {
        timedOut = true
        controller.abort(new Error('请求超时'))
      }, control.timeoutMs)
    : null

  try {
    for (let i = 0; i <= retries; i++) {
      try {
        const response = await waitWithSignal(fetcher(url, {
          ...options,
          signal: controller.signal
        }), controller.signal)

        if (!response.ok && i < retries) {
          void response.body?.cancel().catch(() => undefined)
          await waitForRetry(delay, controller.signal)
          continue
        }

        return await materializeResponse(response, options.method, controller.signal)
      } catch (error) {
        if (callerSignal?.aborted) throw getAbortReason(callerSignal)
        if (timedOut) throw new Error('请求超时')
        if (controller.signal.aborted) throw getAbortReason(controller.signal)
        if (i === retries) throw error
        await waitForRetry(delay, controller.signal)
      }
    }
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId)
    callerSignal?.removeEventListener('abort', handleCallerAbort)
  }

  throw new Error('Fetch retry loop exited unexpectedly')
}
