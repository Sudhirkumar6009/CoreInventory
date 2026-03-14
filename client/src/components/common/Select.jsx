import clsx from 'clsx'

export default function Select({
  label, name, options = [], error, register, placeholder = 'Select...', className = '', ...rest
}) {
  const registration = register ? register(name) : {}
  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      {label && (
        <label htmlFor={name} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <select
        id={name}
        {...registration}
        className={clsx('input-field', error && 'error')}
        {...rest}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  )
}
