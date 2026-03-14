import { useState, useEffect, useCallback } from 'react'
import { TrashIcon, PlusIcon } from '@heroicons/react/24/outline'
import { productService } from '../../api/productService'
import { useDebounce } from '../../hooks/useDebounce'
import { UOM_OPTIONS } from '../../constants'

export default function LineItemTable({ lines = [], onChange, columns, readOnly = false }) {
  const getLineId = (line, idx) => line.id || line._id || `line-${idx}`

  const addLine = () => {
    const newLine = {
      id: crypto.randomUUID(),
      productId: '',
      productName: '',
      description: '',
      qty: 0,
      qtyDone: 0,
      uom: 'units',
    }
    onChange([...lines, newLine])
  }

  const removeLine = (id) => {
    onChange(lines.filter((l, idx) => getLineId(l, idx) !== id))
  }

  const updateLine = (id, field, value) => {
    onChange(
      lines.map((l, idx) => (getLineId(l, idx) === id ? { ...l, [field]: value } : l))
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-1/4">Product</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Description</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-28">Qty</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-28">UoM</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-28">Qty Done</th>
              {!readOnly && <th className="w-12" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {lines.map((line, idx) => {
              const lineId = getLineId(line, idx)
              return (
              <LineRow
                key={lineId}
                lineId={lineId}
                line={line}
                readOnly={readOnly}
                onUpdate={updateLine}
                onRemove={removeLine}
              />
              )
            })}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <button
          onClick={addLine}
          className="w-full py-3 text-sm text-brand-accent hover:bg-brand-accent/5 transition-colors flex items-center justify-center gap-2 border-t border-gray-100"
        >
          <PlusIcon className="w-4 h-4" />
          Add a line
        </button>
      )}
    </div>
  )
}

function LineRow({ lineId, line, readOnly, onUpdate, onRemove }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const debounced = useDebounce(searchTerm, 300)

  useEffect(() => {
    setSearchTerm(line.productName || '')
  }, [line.productName])

  useEffect(() => {
    const shouldSearch = debounced.trim().length >= 2 && debounced !== (line.productName || '')

    if (shouldSearch) {
      productService.getAll({ search: debounced, limit: 5 })
        .then((res) => {
          setResults(res.data?.data || res.data?.products || res.data?.items || [])
          setShowDropdown(true)
        })
        .catch(() => setResults([]))
    } else {
      setShowDropdown(false)
    }
  }, [debounced, line.productName])

  const selectProduct = (product) => {
    onUpdate(lineId, 'productId', product._id || product.id)
    onUpdate(lineId, 'productName', product.name)
    onUpdate(lineId, 'description', product.description || '')
    onUpdate(lineId, 'uom', product.uom || product.unitOfMeasure || 'units')
    setSearchTerm(product.name)
    setShowDropdown(false)
  }

  const onSearchChange = (value) => {
    setSearchTerm(value)
    if (line.productId && value !== line.productName) {
      onUpdate(lineId, 'productId', '')
      onUpdate(lineId, 'productName', '')
    }
  }

  const clearProduct = () => {
    setSearchTerm('')
    setResults([])
    setShowDropdown(false)
    onUpdate(lineId, 'productId', '')
    onUpdate(lineId, 'productName', '')
    onUpdate(lineId, 'description', '')
  }

  return (
    <tr className="group">
      <td className="px-4 py-2">
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search product..."
            disabled={readOnly}
            className="input-field text-sm pr-8"
          />
          {!readOnly && searchTerm && (
            <button
              type="button"
              onClick={clearProduct}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Clear selected product"
            >
              x
            </button>
          )}
          {showDropdown && results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
              {results.map((p) => (
                <button
                  key={p._id || p.id}
                  type="button"
                  onClick={() => selectProduct(p)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </td>
      <td className="px-4 py-2">
        <input
          type="text"
          value={line.description || ''}
          onChange={(e) => onUpdate(lineId, 'description', e.target.value)}
          disabled={readOnly}
          className="input-field text-sm"
          placeholder="Description"
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="number"
          value={line.qty}
          onChange={(e) => onUpdate(lineId, 'qty', Number(e.target.value))}
          disabled={readOnly}
          min="0"
          step="0.01"
          className="input-field text-sm"
        />
      </td>
      <td className="px-4 py-2">
        <select
          value={line.uom || 'units'}
          onChange={(e) => onUpdate(lineId, 'uom', e.target.value)}
          disabled={readOnly}
          className="input-field text-sm"
        >
          {UOM_OPTIONS.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-2">
        <input
          type="number"
          value={line.qtyDone}
          onChange={(e) => onUpdate(lineId, 'qtyDone', Number(e.target.value))}
          disabled={readOnly}
          min="0"
          step="0.01"
          className="input-field text-sm"
        />
      </td>
      {!readOnly && (
        <td className="px-2 py-2">
          <button
            type="button"
            onClick={() => onRemove(lineId)}
            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </td>
      )}
    </tr>
  )
}
