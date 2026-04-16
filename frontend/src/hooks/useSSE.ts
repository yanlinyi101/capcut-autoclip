import { useEffect, useRef } from 'react'

interface UseSSEOptions {
  onProgress?: (data: unknown) => void
  onResult?: (data: unknown) => void
  onComplete?: (data: unknown) => void
  onError?: (data: unknown) => void
  onAllComplete?: (data: unknown) => void
}

export function useSSE(url: string | null, options: UseSSEOptions) {
  const optionsRef = useRef(options)
  optionsRef.current = options

  useEffect(() => {
    if (!url) return

    const source = new EventSource(url)

    source.addEventListener('progress', (e) => {
      const data = JSON.parse(e.data)
      optionsRef.current.onProgress?.(data)
    })

    source.addEventListener('result', (e) => {
      const data = JSON.parse(e.data)
      optionsRef.current.onResult?.(data)
    })

    source.addEventListener('complete', (e) => {
      const data = JSON.parse(e.data)
      optionsRef.current.onComplete?.(data)
    })

    source.addEventListener('error', (e) => {
      if (e instanceof MessageEvent) {
        const data = JSON.parse(e.data)
        optionsRef.current.onError?.(data)
      }
    })

    source.addEventListener('all_complete', (e) => {
      const data = JSON.parse(e.data)
      optionsRef.current.onAllComplete?.(data)
      source.close()
    })

    source.onerror = () => {
      source.close()
    }

    return () => {
      source.close()
    }
  }, [url])
}
