import * as React from 'react'
import { cn } from '@/lib/utils'

type ProgressProps = React.ComponentProps<'div'> & { value: number }

function Progress({ className, value, ...props }: ProgressProps) {
  const v = Math.min(100, Math.max(0, value))
  return (
    <div
      role="progressbar"
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        'relative h-2 w-full overflow-hidden rounded-full bg-neutral-800',
        className,
      )}
      {...props}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-[width] duration-300 ease-out"
        style={{ width: `${v}%` }}
      />
    </div>
  )
}

export { Progress }
