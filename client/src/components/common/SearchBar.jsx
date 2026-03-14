import { useState, useEffect } from 'react'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useDebounce } from '../../hooks/useDebounce'

export default function SearchBar({ onSearch, placeholder = 'Search...', className = '' }) {
  const [value, setValue] = useState('')
  const debounced = useDebounce(value, 300)

  useEffect(() => {
    onSearch(debounced)
  }, [debounced, onSearch])

  const handleClear = () => {
    setValue('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') handleClear()
  }

  return (
    <div className={`relative ${className}`}>
      <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="input-field pl-9 pr-9"
      />
      {value && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-100 transition-colors"
        >
          <XMarkIcon className="w-4 h-4 text-gray-400" />
        </button>
      )}
    </div>
  )
}
