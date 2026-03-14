import { useEffect, useMemo, useState } from "react";
import { TrashIcon, PlusIcon } from "@heroicons/react/24/outline";
import { productService } from "../../api/productService";
import { warehouseService } from "../../api/warehouseService";
import { useDebounce } from "../../hooks/useDebounce";
import { UOM_OPTIONS } from "../../constants";

const toNumberOrDefault = (value, fallback = 0) => {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getProductIdValue = (line) => {
  const raw = line?.productId || line?.product || null;
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  return raw._id || raw.id || "";
};

const getProductNameValue = (line) => {
  return (
    line?.productName || line?.product?.name || line?.productId?.name || ""
  );
};

export default function LineItemTable({
  lines = [],
  onChange,
  readOnly = false,
  showLocation = false,
  locationField = "toLocationId",
  locationLabel = "Location",
  locationOptions,
  locationWarehouse,
}) {
  const [locations, setLocations] = useState([]);

  const getLineId = (line, idx) => line.id || line._id || `line-${idx}`;

  useEffect(() => {
    if (!showLocation || Array.isArray(locationOptions)) return;

    warehouseService
      .getLocations(
        locationWarehouse ? { warehouse: locationWarehouse } : undefined,
      )
      .then((res) => setLocations(res.data?.data || res.data?.locations || []))
      .catch(() => setLocations([]));
  }, [showLocation, locationOptions, locationWarehouse]);

  const resolvedLocations = useMemo(() => {
    if (Array.isArray(locationOptions)) return locationOptions;
    return locations;
  }, [locationOptions, locations]);

  const addLine = () => {
    onChange([
      ...(lines || []),
      {
        id: crypto.randomUUID(),
        productId: "",
        productName: "",
        description: "",
        qty: 0,
        qtyDone: 0,
        uom: "units",
        [locationField]: "",
      },
    ]);
  };

  const removeLine = (id) => {
    onChange((lines || []).filter((l, idx) => getLineId(l, idx) !== id));
  };

  const patchLine = (id, patch) => {
    onChange(
      (lines || []).map((l, idx) =>
        getLineId(l, idx) === id ? { ...l, ...patch } : l,
      ),
    );
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px]">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-1/4">
                Product
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                Description
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-28">
                Qty
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-28">
                UoM
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-28">
                Qty Done
              </th>
              {showLocation && (
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-48">
                  {locationLabel}
                </th>
              )}
              {!readOnly && <th className="w-12" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {(lines || []).map((line, idx) => {
              const lineId = getLineId(line, idx);
              return (
                <LineRow
                  key={lineId}
                  lineId={lineId}
                  line={line}
                  readOnly={readOnly}
                  onPatch={patchLine}
                  onRemove={removeLine}
                  showLocation={showLocation}
                  locationField={locationField}
                  locations={resolvedLocations}
                />
              );
            })}
            {(lines || []).length === 0 && (
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
  onPatch,
  onRemove,
  showLocation,
  locationField,
  locations,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [fetchingDetails, setFetchingDetails] = useState(false);
  const debounced = useDebounce(searchTerm, 300);
  const selectedProductId = getProductIdValue(line);
  const selectedProductName = getProductNameValue(line);
  const qtyValue = toNumberOrDefault(line?.qty ?? line?.qtyOrdered, 0);
  const qtyDoneValue = toNumberOrDefault(line?.qtyDone, 0);
  const currentLocation = line?.[locationField] || "";

  useEffect(() => {
    setSearchTerm(selectedProductName);
  }, [selectedProductName]);

  useEffect(() => {
    const shouldSearch =
      debounced.trim().length >= 2 && debounced !== selectedProductName;
    if (!shouldSearch) {
      setShowDropdown(false);
      return;
    }

    productService
      .getAll({ search: debounced, limit: 8 })
      .then((res) => {
        setResults(
          res.data?.data || res.data?.products || res.data?.items || [],
        );
        setShowDropdown(true);
      })
      .catch(() => {
        setResults([]);
        setShowDropdown(false);
      });
  }, [debounced, selectedProductName]);

  const applyProductDetails = async (product) => {
    const productId = product._id || product.id;
    const basePatch = {
      productId,
      productName: product.name || "",
      description:
        line?.description || product.description || product.sku || "",
      uom: product.uom || product.unitOfMeasure || line?.uom || "units",
    };

    onPatch(lineId, basePatch);

    setFetchingDetails(true);
    try {
      const stockRes = await productService.getStock(productId);
      const stockData = stockRes.data?.data || {};
      const byLocation = Array.isArray(stockData.byLocation)
        ? stockData.byLocation
        : [];

      const preferredLocationId =
        byLocation.find(
          (entry) => toNumberOrDefault(entry?.onHand ?? entry?.quantity, 0) > 0,
        )?.locationId ||
        byLocation[0]?.locationId ||
        "";

      onPatch(lineId, {
        ...basePatch,
        availableQty: toNumberOrDefault(stockData.totalOnHand, 0),
        ...(showLocation && !line?.[locationField] && preferredLocationId
          ? { [locationField]: preferredLocationId }
          : {}),
      });
    } catch {
      try {
        const detailRes = await productService.getById(productId);
        const detail = detailRes.data?.data || detailRes.data || {};
        onPatch(lineId, {
          ...basePatch,
          description:
            line?.description || detail.description || product.sku || "",
          uom: detail.uom || detail.unitOfMeasure || basePatch.uom,
        });
      } catch {
        // Keep base patch if detail fetch fails.
      }
    } finally {
      setFetchingDetails(false);
    }
  };

  const selectProduct = (product) => {
    setSearchTerm(product.name || "");
    setShowDropdown(false);
    void applyProductDetails(product);
  };

  const onSearchChange = (value) => {
    setSearchTerm(value);
    if (selectedProductId && value !== selectedProductName) {
      onPatch(lineId, {
        productId: "",
        productName: "",
        description: "",
      });
    }
  };

  const clearProduct = () => {
    setSearchTerm("");
    setResults([]);
    setShowDropdown(false);
    onPatch(lineId, {
      productId: "",
      productName: "",
      description: "",
      availableQty: 0,
    });
  };

  const onQtyChange = (value) => {
    onPatch(lineId, { qty: toNumberOrDefault(value, 0) });
  };

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
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
              aria-label="Clear selected product"
            >
              x
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
          {fetchingDetails && (
            <p className="text-[11px] text-gray-400 mt-1">
              Loading product details...
            </p>
          )}
        </div>
      </td>

      <td className="px-4 py-2">
        <input
          type="text"
          value={line?.description || ""}
          onChange={(e) => onPatch(lineId, { description: e.target.value })}
          disabled={readOnly}
          placeholder="Description"
          className="input-field text-sm"
        />
      </td>

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

      <td className="px-4 py-2">
        <select
          value={line?.uom || "units"}
          onChange={(e) => onPatch(lineId, { uom: e.target.value })}
          disabled={readOnly}
          className="input-field text-sm"
        >
          {UOM_OPTIONS.map((uom) => (
            <option key={uom} value={uom}>
              {uom}
            </option>
          ))}
        </select>
      </td>

      <td className="px-4 py-2">
        <input
          type="number"
          value={qtyDoneValue}
          onChange={(e) =>
            onPatch(lineId, { qtyDone: toNumberOrDefault(e.target.value, 0) })
          }
          disabled={readOnly}
          min="0"
          step="0.01"
          className="input-field text-sm"
        />
      </td>

      {showLocation && (
        <td className="px-4 py-2">
          <select
            value={currentLocation}
            onChange={(e) =>
              onPatch(lineId, { [locationField]: e.target.value })
            }
            disabled={readOnly}
            className="input-field text-sm"
          >
            <option value="">Select location...</option>
            {(locations || []).map((loc) => (
              <option key={loc._id || loc.id} value={loc._id || loc.id}>
                {loc.name}
                {loc.shortCode ? ` (${loc.shortCode})` : ""}
              </option>
            ))}
          </select>
        </td>
      )}

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
