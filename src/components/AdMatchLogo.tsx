import { cn } from '@/lib/utils'

export function AdMatchLogo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 font-bold tracking-tight',
        className,
      )}
    >
      <span
        className="inline-block h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 shadow-lg shadow-violet-500/25"
        aria-hidden
      />
      <span className="gradient-text text-xl">AdMatch</span>
    </span>
  )
}
