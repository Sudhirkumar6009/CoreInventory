import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { deliveryService } from "../../api/deliveryService";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { useRole } from "../../hooks/useRole";
import { previewRef } from "../../utils/generateReference";
import { STATUS_OPTIONS } from "../../constants";
import Button from "../../components/common/Button";
import StatusStepper from "../../components/common/StatusStepper";
import LineItemTable from "../../components/common/LineItemTable";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Spinner from "../../components/common/Spinner";
import toast from "react-hot-toast";

const STEPS = ["Draft", "Waiting", "Ready", "Done"];
const ALLOWED_STATUS = ["draft", "waiting", "ready", "done", "cancelled"];

const toDateInputValue = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value.split("T")[0] || "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().split("T")[0] || "";
};

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
    qty: Number(line.qty ?? line.qtyOrdered ?? 0),
    qtyDone: Number(line.qtyDone ?? 0),
    uom: line.uom || line.productId?.uom || line.product?.uom || "units",
    fromLocationId: line.fromLocationId?._id || line.fromLocationId || null,
  }));
};

export default function DeliveryFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isManager } = useRole();
  const isNew = !id || id === "new" || id === "undefined";
  useDocumentTitle(isNew ? "New Delivery" : `Delivery ${id}`);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();
  const [lines, setLines] = useState([]);
  const [status, setStatus] = useState("draft");
  const [showCancel, setShowCancel] = useState(false);

  const {
    data: delivery,
    isLoading: fetchLoading,
    isError: fetchError,
    error: fetchErrorDetails,
  } = useQuery({
    queryKey: ["delivery", id],
    queryFn: () =>
      deliveryService.getById(id).then((r) => r.data?.data || r.data),
    enabled: !isNew,
  });

  useEffect(() => {
    if (delivery) {
      const nextStatus = ALLOWED_STATUS.includes(delivery.status)
        ? delivery.status
        : "draft";
      reset({
        reference: delivery.reference,
        supplierOrCustomer: delivery.supplierOrCustomer || "",
        scheduledDate: toDateInputValue(delivery.scheduledDate),
        carrier: delivery.carrier,
      });
      setLines(
        normalizeLines(
          Array.isArray(delivery.moveLines)
            ? delivery.moveLines
            : Array.isArray(delivery.lines)
              ? delivery.lines
              : Array.isArray(delivery.items)
                ? delivery.items
                : [],
        ),
      );
      setStatus(nextStatus);
    } else if (isNew) {
      reset({ reference: previewRef("OUT"), supplierOrCustomer: "", scheduledDate: new Date().toISOString().split('T')[0], carrier: "" });
      setLines([]);
      setStatus("draft");
    }
  }, [delivery, isNew, reset]);

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (!isNew && !id) {
        throw new Error("Delivery id is missing for update");
      }
      return isNew
        ? deliveryService.create(data)
        : deliveryService.update(id, data);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      toast.success("Delivery saved");
      const created = res.data?.data || res.data;
      if (created?.status) setStatus(created.status);
      const newId = created?._id || created?.id || id;
      if (isNew) navigate(`/operations/deliveries/${newId}`, { replace: true });
    },
    onError: (err) => toast.error(err.response?.data?.message || "Save failed"),
  });


  const cancelMutation = useMutation({
    mutationFn: () => deliveryService.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["delivery", id] });
      toast.success("Delivery cancelled");
      setShowCancel(false);
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || "Cancel failed"),
  });



  const onSave = (formData) => {
    const hasPartialLines = (lines || []).some((line) => {
      const productId = getLineProductId(line);
      const qtyOrdered = Number(line.qty || line.qtyOrdered || 0);
      const hasAnyData =
        !!productId || qtyOrdered > 0 || Number(line.qtyDone || 0) > 0;
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
        qtyOrdered: Number(line.qty || line.qtyOrdered || 0),
        qtyDone: Number(line.qtyDone || 0),
        uom: line.uom || "units",
        fromLocationId: line.fromLocationId || null,
      }))
      .filter((line) => line.productId && line.qtyOrdered > 0);

    saveMutation.mutate({
      ...formData,
      reference: formData.reference || previewRef("OUT"),
      moveLines,
      status: isManager ? status : "draft",
    });
  };

  const isReadOnly = status === "done" || status === "cancelled";

  if (fetchLoading && !isNew)
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );

  if (fetchError && !isNew) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
        Failed to load delivery details. {fetchErrorDetails?.response?.data?.message || fetchErrorDetails?.message || "Please retry."}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isNew ? "New Delivery" : delivery?.reference || "Delivery"}
        </h1>
        <div className="flex items-center gap-3">
          {status === "draft" && (
            <>
              <Button
                variant="secondary"
                onClick={() => navigate("/operations/deliveries")}
              >
                Discard
              </Button>
              <Button
                onClick={handleSubmit(onSave)}
                loading={saveMutation.isPending}
              >
                Save
              </Button>
            </>
          )}
          {status !== "draft" && isManager && (
            <Button
              onClick={handleSubmit(onSave)}
              loading={saveMutation.isPending}
            >
              Save
            </Button>
          )}
          {(status === "waiting" || status === "ready") && (
            <>
              <Button variant="secondary" onClick={() => setShowCancel(true)}>
                Cancel
              </Button>
            </>
          )}

          {status === "cancelled" && (
            <Button
              variant="secondary"
              onClick={() => navigate("/operations/deliveries")}
            >
              Back to List
            </Button>
          )}
        </div>
      </div>

      {/* Status Stepper */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <StatusStepper
          steps={STEPS}
          current={status?.charAt(0).toUpperCase() + status?.slice(1)}
        />
      </div>

      {/* Form Fields */}
      <form className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Reference No *
            </label>
            <input
              {...register("reference", { required: "Reference is required" })}
              className="input-field"
              placeholder="e.g. WH/OUT/00001"
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
              Customer / Vendor *
            </label>
            <input
              {...register("supplierOrCustomer", { required: "Customer / Vendor is required" })}
              className="input-field"
              placeholder="e.g. Acme Corp"
              disabled={isReadOnly}
            />
            {errors.supplierOrCustomer && (
              <p className="text-xs text-red-500 mt-1">
                {errors.supplierOrCustomer.message}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Scheduled Date *
            </label>
            <input
              type="date"
              {...register("scheduledDate", { required: "Date is required" })}
              className="input-field"
              disabled={isReadOnly}
            />
            {errors.scheduledDate && (
              <p className="text-xs text-red-500 mt-1">
                {errors.scheduledDate.message}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Carrier
            </label>
            <input
              {...register("carrier")}
              className="input-field"
              placeholder="Carrier / courier name"
              disabled={isReadOnly}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="input-field"
              disabled={!isManager}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </form>

      {/* Product Lines */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          Product Lines
        </h2>
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-4 py-2 mb-3">
          Select the <strong>source location</strong> for each product line —
          stock will be deducted from there when you validate.
        </div>
        <LineItemTable
          lines={lines}
          onChange={setLines}
          readOnly={isReadOnly}
          showLocation={true}
          locationField="fromLocationId"
          locationLabel="Source Location"
          hideQtyDone={status !== 'ready' && status !== 'done'}
        />
      </div>

      <ConfirmDialog
        isOpen={showCancel}
        onClose={() => setShowCancel(false)}
        onConfirm={() => cancelMutation.mutate()}
        title="Cancel Delivery"
        message="Are you sure you want to cancel this delivery? This action cannot be undone."
        confirmLabel="Cancel Delivery"
        loading={cancelMutation.isPending}
      />
    </div>
  );
}
