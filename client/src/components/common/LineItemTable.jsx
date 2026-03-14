import { useState, useEffect } from "react";
import { TrashIcon, PlusIcon } from "@heroicons/react/24/outline";
import { productService } from "../../api/productService";
import { warehouseService } from "../../api/warehouseService";
import { useDebounce } from "../../hooks/useDebounce";
import { useQuery } from "@tanstack/react-query";
import { UOM_OPTIONS } from "../../constants";

const toNumberOrDefault = (value, fallback = 0) => {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * LineItemTable
 * Props:
 *  lines        – array of line objects
 *  onChange     – (lines) => void
 *  readOnly     – boolean
 *  showLocation – boolean: show a location dropdown column per line
 *  locationField – string: which field to set on the line ("toLocationId" | "fromLocationId")
 *  locationLabel – string: column header label (default "Location")
 */
export default function LineItemTable({
  lines = [],
  onChange,
  readOnly = false,
  showLocation = false,
  locationField = "toLocationId",
  locationLabel = "Location",
}) {
  const getLineId = (line, idx) => line.id || line._id || `line-${idx}`;

  // Fetch locations once for all rows
  const { data: locations = [] } = useQuery({
    queryKey: ["locations"],
    queryFn: () =>
      warehouseService
        .getLocations()
        .then((r) => r.data?.data || r.data?.locations || r.data || []),
    enabled: showLocation,
  });

  const addLine = () => {
    onChange([
      ...lines,
      {
        id: crypto.randomUUID(),
        productId: "",
        productName: "",
        description: "",
        qty: 0,
        qtyOrdered: 0,
        qtyDone: 0,
        uom: "units",
        toLocationId: "",
        fromLocationId: "",
      },
    ]);
  };

  const removeLine = (id) => {
    onChange(lines.filter((l, idx) => getLineId(l, idx) !== id));
  };

  const updateLine = (id, field, value) => {
    onChange(
      lines.map((l, idx) =>
        getLineId(l, idx) === id ? { ...l, [field]: value } : l,
      ),
    );
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-1/4">
                Product
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                Description
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-24">
                Qty
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-24">
                UoM
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-24">
                Qty Done
              </th>
              {showLocation && (
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-40">
                  {locationLabel}
                </th>
              )}
              {!readOnly && <th className="w-12" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {lines.map((line, idx) => {
              const lineId = getLineId(line, idx);
              return (
                <LineRow
                  key={lineId}
                  lineId={lineId}
                  line={line}
                  readOnly={readOnly}
                  onUpdate={updateLine}
                  onRemove={removeLine}
                  showLocation={showLocation}
                  locationField={locationField}
                  locations={locations}
                />
              );
            })}
            {lines.length === 0 && (
              <tr>
                <td
                  colSpan={showLocation ? 7 : 6}
                  className="px-4 py-8 text-center text-sm text-gray-400"
                >
                  No product lines yet. Click &ldquo;Add a line&rdquo; below.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <button
          type="button"
          onClick={addLine}
          className="w-full py-3 text-sm text-brand-accent hover:bg-brand-accent/5 transition-colors flex items-center justify-center gap-2 border-t border-gray-100"
        >
          <PlusIcon className="w-4 h-4" />
          Add a line
        </button>
      )}
    </div>
  );
}

function LineRow({
  lineId,
  line,
  readOnly,
  onUpdate,
  onRemove,
  showLocation,
  locationField,
  locations,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounced = useDebounce(searchTerm, 300);

  useEffect(() => {
    setSearchTerm(line.productName || "");
  }, [line.productName]);

  useEffect(() => {
    const shouldSearch =
      debounced.trim().length >= 2 && debounced !== (line.productName || "");

    if (shouldSearch) {
      productService
        .getAll({ search: debounced, limit: 8 })
        .then((res) => {
          setResults(
            res.data?.data || res.data?.products || res.data?.items || [],
          );
          setShowDropdown(true);
        })
        .catch(() => setResults([]));
    } else {
      setShowDropdown(false);
    }
  }, [debounced, line.productName]);

  const selectProduct = (product) => {
    const existingQty = toNumberOrDefault(line.qtyOrdered ?? line.qty, 0);
    const defaultQty = existingQty > 0 ? existingQty : 1;

    onUpdate(lineId, "productId", product._id || product.id);
    onUpdate(lineId, "productName", product.name);
    onUpdate(lineId, "description", product.description || "");
    onUpdate(lineId, "uom", product.uom || product.unitOfMeasure || "units");
    onUpdate(lineId, "qty", defaultQty);
    onUpdate(lineId, "qtyOrdered", defaultQty);
    if (toNumberOrDefault(line.qtyDone, 0) <= 0) {
      onUpdate(lineId, "qtyDone", defaultQty);
    }
    setSearchTerm(product.name);
    setShowDropdown(false);
  };

  const onSearchChange = (value) => {
    setSearchTerm(value);
    if (line.productId && value !== line.productName) {
      onUpdate(lineId, "productId", "");
      onUpdate(lineId, "productName", "");
    }
  };

  const clearProduct = () => {
    setSearchTerm("");
    setResults([]);
    setShowDropdown(false);
    onUpdate(lineId, "productId", "");
    onUpdate(lineId, "productName", "");
    onUpdate(lineId, "description", "");
  };

  const qtyValue = toNumberOrDefault(line.qtyOrdered ?? line.qty, 0);
  const qtyDoneValue = toNumberOrDefault(line.qtyDone, 0);

  const onQtyChange = (value) => {
    const nextQty = toNumberOrDefault(value, 0);
    const previousQty = toNumberOrDefault(line.qtyOrdered ?? line.qty, 0);
    onUpdate(lineId, "qty", nextQty);
    onUpdate(lineId, "qtyOrdered", nextQty);
    if (qtyDoneValue === 0 || qtyDoneValue === previousQty) {
      onUpdate(lineId, "qtyDone", nextQty);
    }
  };

  const currentLocation = line[locationField] || "";

  return (
    <tr className="group">
      {/* Product search */}
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
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
              aria-label="Clear selected product"
            >
              ✕
            </button>
          )}
          {showDropdown && results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {results.map((p) => (
                <button
                  key={p._id || p.id}
                  type="button"
                  onClick={() => selectProduct(p)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                >
                  <div className="font-medium text-gray-900">{p.name}</div>
                  <div className="text-xs text-gray-500">
                    {p.sku || "--"} | On hand:{" "}
                    {toNumberOrDefault(p.onHand ?? p.totalOnHand, 0)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </td>

      {/* Description */}
      <td className="px-4 py-2">
        <input
          type="text"
          value={line.description || ""}
          onChange={(e) => onUpdate(lineId, "description", e.target.value)}
          disabled={readOnly}
          className="input-field text-sm"
          placeholder="Description"
        />
      </td>

      {/* Qty */}
      <td className="px-4 py-2">
        <input
          type="number"
          value={qtyValue}
          onChange={(e) => onQtyChange(e.target.value)}
          disabled={readOnly}
          min="0"
          step="0.01"
          className="input-field text-sm"
        />
      </td>

      {/* UoM */}
      <td className="px-4 py-2">
        <select
          value={line.uom || "units"}
          onChange={(e) => onUpdate(lineId, "uom", e.target.value)}
          disabled={readOnly}
          className="input-field text-sm"
        >
          {UOM_OPTIONS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </td>

      {/* Qty Done */}
      <td className="px-4 py-2">
        <input
          type="number"
          value={qtyDoneValue}
          onChange={(e) =>
            onUpdate(lineId, "qtyDone", toNumberOrDefault(e.target.value, 0))
          }
          disabled={readOnly}
          min="0"
          step="0.01"
          className="input-field text-sm"
        />
      </td>

      {/* Location (optional) */}
      {showLocation && (
        <td className="px-4 py-2">
          <select
            value={currentLocation}
            onChange={(e) => onUpdate(lineId, locationField, e.target.value)}
            disabled={readOnly}
            className="input-field text-sm"
          >
            <option value="">Select location...</option>
            {locations.map((loc) => (
              <option key={loc._id || loc.id} value={loc._id || loc.id}>
                {loc.name}
                {loc.shortCode ? ` (${loc.shortCode})` : ""}
              </option>
            ))}
          </select>
        </td>
      )}

      {/* Delete */}
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
  );
}
