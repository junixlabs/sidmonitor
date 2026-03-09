import { useState, useCallback } from 'react'

import { Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'

interface CopyButtonProps {
  text: string
  label?: string
  className?: string
}

export function CopyButton({ text, label = 'Copied to clipboard', className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success(label)
    setTimeout(() => setCopied(false), 2000)
  }, [text, label])

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'inline-flex items-center justify-center rounded-md p-1.5 text-text-muted hover:bg-surface-secondary hover:text-text-secondary transition-colors',
        className
      )}
      title="Copy"
    >
      {copied ? (
        <Check className="h-4 w-4 text-status-success" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </button>
  )
}
