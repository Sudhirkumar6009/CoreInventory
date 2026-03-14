import clsx from 'clsx'
import Spinner from './Spinner'

const variants = {
  primary:   'bg-brand-accent text-white hover:bg-rose-600 shadow-sm shadow-brand-accent/25',
  secondary: 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50',
  danger:    'bg-red-600 text-white hover:bg-red-700 shadow-sm shadow-red-500/25',
  ghost:     'text-brand-accent hover:text-rose-700 underline-offset-2 hover:underline',
  success:   'bg-green-600 text-white hover:bg-green-700 shadow-sm shadow-green-500/25',
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-2.5 text-base',
}

export default function Button({
  children, variant = 'primary', size = 'md', loading = false,
  disabled = false, onClick, type = 'button', className = '', ...rest
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200',
        variants[variant],
        sizes[size],
        (disabled || loading) && 'opacity-50 cursor-not-allowed',
        className
      )}
      {...rest}
    >
      {loading ? (
        <>
          <Spinner size="sm" />
          <span>Loading...</span>
        </>
      ) : children}
    </button>
  )
}
