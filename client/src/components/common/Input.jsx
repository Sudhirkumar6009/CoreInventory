import clsx from 'clsx'

export default function Input({
  label, name, error, register, helperText, className = '', ...rest
}) {
  const registration = register ? register(name) : {}
  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      {label && (
        <label htmlFor={name} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        id={name}
        {...registration}
        className={clsx(
          'input-field',
          error && 'error'
        )}
        {...rest}
      />
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
      {helperText && !error && (
        <p className="text-xs text-gray-400 mt-0.5">{helperText}</p>
      )}
    </div>
  )
}
