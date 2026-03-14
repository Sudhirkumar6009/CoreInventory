import clsx from 'clsx'
import { CheckIcon } from '@heroicons/react/24/solid'

export default function StatusStepper({ steps = [], current = '' }) {
  const currentIndex = steps.findIndex(
    (s) => s.toLowerCase() === current?.toLowerCase()
  )

  return (
    <div className="flex items-center w-full py-4">
      {steps.map((step, idx) => {
        const isPast = idx < currentIndex
        const isCurrent = idx === currentIndex
        const isFuture = idx > currentIndex

        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            {/* Circle */}
            <div className="flex flex-col items-center">
              <div
                className={clsx(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300',
                  isPast && 'bg-green-500 text-white shadow-sm shadow-green-500/30',
                  isCurrent && 'bg-brand-accent text-white shadow-sm shadow-brand-accent/30 ring-4 ring-brand-accent/20',
                  isFuture && 'bg-gray-100 text-gray-400 border-2 border-gray-200'
                )}
              >
                {isPast ? <CheckIcon className="w-4 h-4" /> : idx + 1}
              </div>
              <span
                className={clsx(
                  'mt-2 text-xs font-medium whitespace-nowrap',
                  isPast && 'text-green-600',
                  isCurrent && 'text-brand-accent font-semibold',
                  isFuture && 'text-gray-400'
                )}
              >
                {step}
              </span>
            </div>

            {/* Connecting line */}
            {idx < steps.length - 1 && (
              <div
                className={clsx(
                  'flex-1 h-0.5 mx-2 rounded-full transition-all duration-300',
                  idx < currentIndex ? 'bg-green-500' : 'bg-gray-200'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
