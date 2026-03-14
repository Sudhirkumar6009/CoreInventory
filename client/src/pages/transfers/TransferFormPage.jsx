import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { transferService } from "../../api/transferService";
import { warehouseService } from "../../api/warehouseService";
import { STATUS_OPTIONS } from "../../constants";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { useRole } from "../../hooks/useRole";
import { previewRef } from "../../utils/generateReference";
import Button from "../../components/common/Button";
import StatusStepper from "../../components/common/StatusStepper";
import LineItemTable from "../../components/common/LineItemTable";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Spinner from "../../components/common/Spinner";
import toast from "react-hot-toast";

const STEPS = ["Draft", "Waiting", "Ready", "Done"];
const STATUS_ASC_ORDER = ["draft", "waiting", "ready", "done", "cancelled"];

const getLineProductId = (line) => {
  const raw = line?.productId || line?.product;
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  return raw._id || raw.id || "";
};

const normalizeLines = (rawLines = []) => {
  return rawLines.map((line, idx) => ({
    id: line.id || line._id || `line-${idx}`,
    productId: getLineProductId(line),
    productName:
      line.productName || line.productId?.name || line.product?.name || "",
    description: line.description || "",
    qty: Number(line.qty ?? line.qtyOrdered ?? 0),
    qtyDone: Number(line.qtyDone ?? 0),
    uom: line.uom || line.productId?.uom || line.product?.uom || "units",
    fromLocationId: line.fromLocationId?._id || line.fromLocationId || null,
    toLocationId: line.toLocationId?._id || line.toLocationId || null,
  }));
};

export default function TransferFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = !id || id === "new" || id === "undefined";
  const { isManager, isStaff } = useRole();

  useDocumentTitle(isNew ? "New Transfer" : `Transfer ${id}`);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm();
  const [lines, setLines] = useState([]);
  const [status, setStatus] = useState("draft");
  const [showCancel, setShowCancel] = useState(false);

  const { data: locations = [] } = useQuery({
    queryKey: ["locations"],
    queryFn: () =>
      warehouseService
        .getLocations()
        .then((r) => r.data?.data || r.data?.locations || r.data || []),
  });

  const srcLoc = watch("sourceLocation");
  const destLoc = watch("destinationLocation");
  const srcText = watch("sourceText");
  const destText = watch("destinationText");
  const sameLocation = srcLoc && destLoc && srcLoc === destLoc;
  const sameTextLocation =
    isStaff &&
    !!srcText &&
    !!destText &&
    srcText.trim().toLowerCase() === destText.trim().toLowerCase();
  const sourceLocationObj = locations.find(
    (loc) => String(loc._id || loc.id) === String(srcLoc),
  );
  const destinationLocationObj = locations.find(
    (loc) => String(loc._id || loc.id) === String(destLoc),
  );
  const crossWarehouse =
    !!sourceLocationObj &&
    !!destinationLocationObj &&
    String(sourceLocationObj.warehouseId?._id || sourceLocationObj.warehouseId) !==
      String(destinationLocationObj.warehouseId?._id || destinationLocationObj.warehouseId);

  const { data: transfer, isLoading: fetchLoading } = useQuery({
    queryKey: ["transfer", id],
    queryFn: () =>
      transferService.getById(id).then((r) => r.data?.data || r.data),
    enabled: !isNew,
  });

  useEffect(() => {
    if (transfer) {
      const rawLines =
        transfer.moveLines || transfer.lines || transfer.items || [];
      const firstLine = rawLines[0] || {};
      reset({
        reference: transfer.reference,
        sourceLocation:
          transfer.sourceLocation?._id ||
          transfer.sourceLocation ||
          firstLine.fromLocationId?._id ||
          firstLine.fromLocationId ||
          "",
        sourceText: transfer.sourceText || "",
        destinationLocation:
          transfer.destinationLocation?._id ||
          transfer.destinationLocation ||
          firstLine.toLocationId?._id ||
          firstLine.toLocationId ||
          "",
        destinationText: transfer.destinationText || "",
        warehouseLabel: transfer.warehouseLabel || "",
        scheduledDate: transfer.scheduledDate?.split("T")[0],
        notes: transfer.notes || "",
      });
      setLines(normalizeLines(rawLines));
      setStatus(transfer.status || "draft");
    } else if (isNew) {
      reset({
        reference: previewRef("INT"),
        sourceLocation: "",
        sourceText: "",
        destinationLocation: "",
        destinationText: "",
        warehouseLabel: "",
        scheduledDate: new Date().toISOString().split("T")[0],
        notes: "",
      });
      setLines([]);
      setStatus("draft");
    }
  }, [transfer, isNew, reset]);

  const saveMutation = useMutation({
    mutationFn: (data) =>
      isNew ? transferService.create(data) : transferService.update(id, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      toast.success("Transfer saved");
      const created = res.data?.data || res.data;
      const newId = created?._id || created?.id;
      if (isNew && newId) {
        navigate(`/operations/transfers/${newId}`, {
          replace: true,
        });
      }
    },
    onError: (err) => toast.error(err.response?.data?.message || "Save failed"),
  });

  const validateMutation = useMutation({
    mutationFn: () => transferService.validate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["transfer", id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-kpis"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Transfer validated! Stock moved between locations.");
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || "Validation failed"),
  });

  const cancelMutation = useMutation({
    mutationFn: () => transferService.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["transfer", id] });
      toast.success("Transfer cancelled");
      setShowCancel(false);
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || "Cancel failed"),
  });

  const onSave = (formData) => {
    if (sameLocation) {
      toast.error("Source and destination cannot be the same location.");
      return;
    }

    if (sameTextLocation) {
      toast.error("From and To cannot be the same.");
      return;
    }

    if (isStaff && crossWarehouse) {
      toast.error("Staff transfers must stay inside the same warehouse.");
      return;
    }

    if (isStaff) {
      if (!formData.warehouseLabel?.trim()) {
        toast.error("Warehouse is required.");
        return;
      }
      if (!formData.sourceText?.trim() || !formData.destinationText?.trim()) {
        toast.error("From and To are required.");
        return;
      }
    }

    const hasPartialLines = (lines || []).some((line) => {
      const productId = getLineProductId(line);
      const qtyOrdered = Number(line.qty || line.qtyOrdered || 0);
      const hasAnyData =
        !!productId ||
        !!line.description ||
        qtyOrdered > 0 ||
        Number(line.qtyDone || 0) > 0;
      const isValid = !!productId && qtyOrdered > 0;
      return hasAnyData && !isValid;
    });

    if (hasPartialLines) {
      toast.error(
        "Complete product and quantity for each line, or remove incomplete lines",
      );
      return;
    }

    const moveLines = (lines || [])
      .map((line) => ({
        productId: getLineProductId(line),
        description: line.description || "",
        qtyOrdered: Number(line.qty || line.qtyOrdered || 0),
        qtyDone: Number(line.qtyDone || 0),
        uom: line.uom || "units",
        fromLocationId: line.fromLocationId || formData.sourceLocation || null,
        toLocationId: line.toLocationId || formData.destinationLocation || null,
      }))
      .filter((line) => line.productId && line.qtyOrdered > 0);

    saveMutation.mutate({
      ...formData,
      moveLines,
      ...(isStaff
        ? {
            sourceLocation: null,
            destinationLocation: null,
            sourceText: formData.sourceText?.trim(),
            destinationText: formData.destinationText?.trim(),
            warehouseLabel: formData.warehouseLabel?.trim(),
          }
        : {}),
      ...(isManager ? { status } : {}),
    });
  };

  const isReadOnly = status === "done" || status === "cancelled";

  if (fetchLoading && !isNew) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  const locationOptions = locations.map((l) => ({
    value: l._id || l.id,
    label: `${l.name}${l.shortCode ? ` (${l.shortCode})` : ""}`,
  }));

  const orderedStatusOptions = [...STATUS_OPTIONS].sort(
    (a, b) => STATUS_ASC_ORDER.indexOf(a) - STATUS_ASC_ORDER.indexOf(b),
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isNew ? "New Transfer" : transfer?.reference || "Transfer"}
        </h1>
        <div className="flex items-center gap-3">
          {!isReadOnly && (
            <>
              <Button
                variant="secondary"
                onClick={() => navigate("/operations/transfers")}
              >
                Discard
              </Button>
              <Button
                onClick={handleSubmit(onSave)}
                loading={saveMutation.isPending}
                disabled={!!sameLocation || !!sameTextLocation}
              >
                Save
              </Button>
            </>
          )}
          {!isNew && isManager && (status === "waiting" || status === "ready") && (
            <>
              <Button variant="secondary" onClick={() => setShowCancel(true)}>
                Cancel
              </Button>
              <Button
                onClick={() => validateMutation.mutate()}
                loading={validateMutation.isPending}
              >
                {status === "ready" ? "Mark as Done" : "Validate"}
              </Button>
            </>
          )}
          {!isNew && (status === "done" || status === "cancelled") && (
            <Button
              variant="secondary"
              onClick={() => navigate("/operations/transfers")}
            >
              Back to List
            </Button>
          )}
        </div>
      </div>

      {isManager && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
          <StatusStepper
            steps={STEPS}
            current={status?.charAt(0).toUpperCase() + status?.slice(1)}
          />
        </div>
      )}

      <form className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Reference No *
            </label>
            <input
              {...register("reference", { required: "Reference is required" })}
              className="input-field"
              placeholder="e.g. WH/INT/00001"
              disabled={isReadOnly}
            />
            {errors.reference && (
              <p className="text-xs text-red-500 mt-1">
                {errors.reference.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Scheduled Date
            </label>
            <input
              type="date"
              {...register("scheduledDate")}
              className="input-field"
              disabled={isReadOnly}
            />
          </div>

          {isManager && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="input-field"
                disabled={isReadOnly}
              >
                {orderedStatusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isStaff ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Warehouse *
                </label>
                <input
                  {...register("warehouseLabel", {
                    required: "Warehouse is required",
                  })}
                  className="input-field"
                  placeholder="e.g. Main Warehouse"
                  disabled={isReadOnly}
                />
                {errors.warehouseLabel && (
                  <p className="text-xs text-red-500 mt-1">{errors.warehouseLabel.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  From *
                </label>
                <input
                  {...register("sourceText", {
                    required: "From is required",
                  })}
                  className="input-field"
                  placeholder="e.g. Rack 1"
                  disabled={isReadOnly}
                />
                {errors.sourceText && (
                  <p className="text-xs text-red-500 mt-1">{errors.sourceText.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  To *
                </label>
                <input
                  {...register("destinationText", {
                    required: "To is required",
                  })}
                  className="input-field"
                  placeholder="e.g. Rack 2"
                  disabled={isReadOnly}
                />
                {errors.destinationText && (
                  <p className="text-xs text-red-500 mt-1">{errors.destinationText.message}</p>
                )}
                {sameTextLocation && (
                  <p className="text-xs text-red-500 mt-1">From and To cannot be the same.</p>
                )}
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Source Location *
                </label>
                <select
                  {...register("sourceLocation", {
                    required: "Source location is required",
                  })}
                  className="input-field"
                  disabled={isReadOnly}
                >
                  <option value="">Select source location...</option>
                  {locationOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {errors.sourceLocation && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.sourceLocation.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Destination Location *
                </label>
                <select
                  {...register("destinationLocation", {
                    required: "Destination location is required",
                  })}
                  className="input-field"
                  disabled={isReadOnly}
                >
                  <option value="">Select destination location...</option>
                  {locationOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {errors.destinationLocation && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.destinationLocation.message}
                  </p>
                )}
                {sameLocation && (
                  <p className="text-xs text-red-500 mt-1">
                    Source and destination cannot be the same location.
                  </p>
                )}
              </div>
            </>
          )}

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Notes
            </label>
            <textarea
              {...register("notes")}
              className="input-field"
              rows={2}
              placeholder="Optional notes..."
              disabled={isReadOnly}
            />
          </div>
        </div>
      </form>

      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          Product Lines
        </h2>
        <div className="text-sm text-teal-700 bg-teal-50 border border-teal-100 rounded-lg px-4 py-2 mb-3">
          Products will be moved from{" "}
          <strong>Source Location to Destination Location</strong> selected
          above.
        </div>
        {isStaff && (
          <div className="text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2 mb-3">
            Staff transfer mode: use Warehouse, From, and To text fields. Transfer is completed immediately after save.
          </div>
        )}
        <LineItemTable
          lines={lines}
          onChange={setLines}
          readOnly={isReadOnly}
        />
      </div>

      {isManager && (
        <ConfirmDialog
          isOpen={showCancel}
          onClose={() => setShowCancel(false)}
          onConfirm={() => cancelMutation.mutate()}
          title="Cancel Transfer"
          message="Are you sure you want to cancel this transfer? This action cannot be undone."
          confirmLabel="Cancel Transfer"
        />
      )}
    </div>
  );
}
