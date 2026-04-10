import { ArrowRight, ImageIcon, Link2, Loader2, Upload } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { AdMatchLogo } from '@/components/AdMatchLogo'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiPageMeta } from '@/lib/api'

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('read failed'))
    r.readAsDataURL(file)
  })
}

export default function InputPage() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [landingUrl, setLandingUrl] = useState('')
  const [metaLoading, setMetaLoading] = useState(false)
  const [pageTitle, setPageTitle] = useState<string | null>(null)
  const [favicon, setFavicon] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  /* Default mock on unless VITE_USE_MOCK_AI=false (set OPENAI_API_KEY + false for live AI). */
  const useMock =
    import.meta.env.VITE_USE_MOCK_AI !== 'false' &&
    import.meta.env.VITE_USE_MOCK_AI !== '0'

  const applyFile = useCallback(async (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) {
      setUploadError('Please upload an image file (PNG, JPG, or WebP).')
      return
    }
    setUploadError(null)
    try {
      const dataUrl = await readFileAsDataUrl(file)
      setImagePreview(dataUrl)
      setImageBase64(dataUrl)
      setImageUrl('')
    } catch {
      setUploadError('Could not read that file. Try again or use an image URL.')
    }
  }, [])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    void applyFile(e.dataTransfer.files[0])
  }

  const testUrl = async () => {
    const u = landingUrl.trim()
    if (!u) {
      toast.error('Enter a landing page URL first.')
      return
    }
    setMetaLoading(true)
    setPageTitle(null)
    setFavicon(null)
    try {
      const meta = await apiPageMeta(u)
      if (!meta.ok) {
        toast.error("Couldn't read that page — check the URL is public.")
        return
      }
      setPageTitle(meta.title)
      setFavicon(meta.favicon)
      toast.success('URL looks good.')
    } catch {
      toast.error('Could not verify URL.')
    } finally {
      setMetaLoading(false)
    }
  }

  const applyImageUrl = () => {
    const u = imageUrl.trim()
    if (!u) {
      toast.error('Paste an image URL first.')
      return
    }
    setUploadError(null)
    setImageBase64(null)
    setImagePreview(u)
  }

  const generate = () => {
    if (!imagePreview) {
      toast.error('Add an ad creative (upload or image URL).')
      return
    }
    if (!landingUrl.trim()) {
      toast.error('Add your landing page URL.')
      return
    }
    if (cooldown > 0) return
    setCooldown(3)
    const t = window.setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          window.clearInterval(t)
          return 0
        }
        return c - 1
      })
    }, 1000)

    navigate('/builder', {
      state: {
        landingUrl: landingUrl.trim(),
        imageBase64: imageBase64,
        imageUrl: imageBase64 ? null : imageUrl.trim() || imagePreview,
        useMock,
        adPreview: imagePreview,
      },
    })
  }

  return (
    <div className="bg-grid min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-8">
        <AdMatchLogo />
        <span className="text-xs text-neutral-500">MVP · AdMatch</span>
      </header>

      <main className="page-enter mx-auto max-w-xl px-4 pb-24 pt-4 md:pt-10">
        <div className="mb-10 text-center">
          <h1 className="mb-3 text-3xl font-bold tracking-tight text-white md:text-4xl">
            Turn any ad into a{' '}
            <span className="gradient-text">perfectly matched</span> landing page.
          </h1>
          <p className="text-lg text-neutral-400">Instantly.</p>
        </div>

        <Card className="border-neutral-800 bg-neutral-950/60">
          <CardContent className="space-y-6 p-6 md:p-8">
            <div className="space-y-2">
              <Label>Ad creative</Label>
              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click()
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className={`flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
                  dragOver
                    ? 'border-violet-500 bg-violet-500/10'
                    : 'border-neutral-700 bg-neutral-900/50 hover:border-neutral-600'
                }`}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void applyFile(e.target.files?.[0])}
                />
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Ad preview"
                    className="max-h-36 rounded-lg object-contain shadow-lg"
                  />
                ) : (
                  <>
                    <Upload className="mb-2 h-10 w-10 text-neutral-500" />
                    <p className="text-sm text-neutral-400">
                      Drag & drop an image, or click to upload
                    </p>
                  </>
                )}
              </div>
              {uploadError ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                  <span>{uploadError}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="btn-scale border-red-800 text-red-100"
                    onClick={() => {
                      setUploadError(null)
                      fileRef.current?.click()
                    }}
                  >
                    Retry
                  </Button>
                </div>
              ) : null}
              <div className="flex gap-2 pt-1">
                <div className="relative flex-1">
                  <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                  <Input
                    placeholder="Or paste image URL…"
                    className="pl-9"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="btn-scale shrink-0 bg-neutral-800"
                  onClick={applyImageUrl}
                >
                  <ImageIcon className="h-4 w-4" />
                  Use URL
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Landing page URL</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://your-product.com"
                  value={landingUrl}
                  onChange={(e) => setLandingUrl(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="btn-scale shrink-0"
                  disabled={metaLoading}
                  onClick={() => void testUrl()}
                >
                  {metaLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Test URL'
                  )}
                </Button>
              </div>
              {pageTitle || favicon ? (
                <div className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/80 px-3 py-2 text-sm">
                  {favicon ? (
                    <img src={favicon} alt="" className="h-6 w-6 rounded" />
                  ) : null}
                  <span className="truncate text-neutral-200">
                    {pageTitle || 'Page detected'}
                  </span>
                </div>
              ) : null}
            </div>

            <Button
              type="button"
              variant="gradient"
              size="lg"
              className="btn-scale h-12 w-full font-semibold"
              disabled={cooldown > 0}
              onClick={generate}
            >
              {cooldown > 0 ? `Wait ${cooldown}s…` : 'Generate My Page →'}
              <ArrowRight className="h-5 w-5" />
            </Button>
            <p className="text-center text-xs text-neutral-500">
              AI reads your ad + existing page to build a personalized version
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
