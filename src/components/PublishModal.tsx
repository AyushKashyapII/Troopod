import confetti from 'canvas-confetti'
import { Check, Copy, Download, ExternalLink, Share2 } from 'lucide-react'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type PublishModalProps = {
  open: boolean
  slug: string
  viewUrl: string
  html: string
  onClose: () => void
  onEditAgain: () => void
}

function fullUrl(viewUrl: string, slug: string) {
  if (viewUrl.startsWith('http')) return viewUrl
  const base = window.location.origin.replace(/\/$/, '')
  if (viewUrl.startsWith('/')) return `${base}${viewUrl}`
  return `${base}/p/${slug}`
}

function displayPath(slug: string) {
  return `admatch.app/p/${slug}`
}

export function PublishModal({
  open,
  slug,
  viewUrl,
  html,
  onClose,
  onEditAgain,
}: PublishModalProps) {
  const url = fullUrl(viewUrl, slug)

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => {
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.35 },
        colors: ['#8b5cf6', '#3b82f6', '#a78bfa', '#60a5fa'],
      })
    }, 120)
    return () => window.clearTimeout(t)
  }, [open])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy')
    }
  }

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'AdMatch page', url })
        toast.success('Shared')
      } else {
        await copy()
      }
    } catch {
      void copy()
    }
  }

  const downloadHtml = () => {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `admatch-${slug}.html`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success('Download started')
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="publish-title"
    >
      <Card
        className={cn(
          'relative max-h-[90vh] w-full max-w-lg overflow-y-auto border-neutral-700 bg-neutral-950',
        )}
      >
        <button
          type="button"
          className="absolute right-3 top-3 rounded-lg p-2 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <CardContent className="flex flex-col items-center gap-5 p-8 pt-10 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500 shadow-lg shadow-violet-500/30">
            <Check className="h-9 w-9 text-white" />
          </div>
          <div>
            <h2
              id="publish-title"
              className="text-2xl font-bold text-white"
            >
              Your page is live! 🎉
            </h2>
            <p className="mt-2 text-sm text-neutral-400">
              Share it with anyone — no login required to view
            </p>
          </div>

          <div className="w-full rounded-xl border border-neutral-800 bg-neutral-900/80 p-3 text-left">
            <p className="mb-1 text-xs text-neutral-500">Published URL</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate text-sm text-violet-300">
                {displayPath(slug)}
              </code>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="btn-scale shrink-0"
                onClick={() => void copy()}
                aria-label="Copy link"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 truncate text-xs text-neutral-500" title={url}>
              Opens at: {url}
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              type="button"
              variant="gradient"
              className="btn-scale flex-1 gap-2"
              onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink className="h-4 w-4" />
              Open Page
            </Button>
            <Button
              type="button"
              variant="outline"
              className="btn-scale flex-1 gap-2"
              onClick={() => void share()}
            >
              <Share2 className="h-4 w-4" />
              Share Link
            </Button>
            <Button
              type="button"
              variant="default"
              className="btn-scale flex-1"
              onClick={onEditAgain}
            >
              Edit Again
            </Button>
          </div>

          <Card className="w-full border-neutral-800 bg-neutral-900/50">
            <CardContent className="p-4 text-sm text-neutral-400">
              Views: 0 | Clicks: 0 | Conversion Rate: —
            </CardContent>
          </Card>

          <Button
            type="button"
            variant="ghost"
            className="btn-scale text-neutral-400 hover:text-white"
            onClick={downloadHtml}
          >
            <Download className="h-4 w-4" />
            Download .html
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
