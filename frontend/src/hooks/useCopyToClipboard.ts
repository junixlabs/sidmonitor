import { useState, useCallback } from 'react'

/**
 * Hook for copy-to-clipboard with per-field "copied" feedback.
 * Returns the currently copied field key and a copy function.
 */
export function useCopyToClipboard(timeout = 2000) {
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const copy = useCallback(
    (text: string, field: string) => {
      navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), timeout)
    },
    [timeout]
  )

  return { copiedField, copy } as const
}
