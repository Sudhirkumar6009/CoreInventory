import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { receiptService } from "../../api/receiptService";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { previewRef } from "../../utils/generateReference";
import Button from "../../components/common/Button";
import StatusStepper from "../../components/common/StatusStepper";
import LineItemTable from "../../components/common/LineItemTable";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Spinner from "../../components/common/Spinner";
import toast from "react-hot-toast";

const STEPS = ["Draft", "Waiting", "Ready", "Done"];

const toNumberOrDefault = (value, fallback = 0) => {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeLineFromApi = (line = {}) => {
  const productObj = typeof line.productId === "object" ? line.productId : null;
  const qtyOrdered = toNumberOrDefault(line.qtyOrdered ?? line.qty, 0);
  return {
    id: line._id || line.id || crypto.randomUUID(),
    productId: productObj?._id || line.productId || "",
    productName: line.productName || productObj?.name || "",
    description: line.description || "",
    qty: qtyOrdered,
    qtyOrdered,
    qtyDone: toNumberOrDefault(line.qtyDone, 0),
    uom: line.uom || productObj?.uom || "units",
    toLocationId: line.toLocationId?._id || line.toLocationId || "",
  };
};

const buildMoveLines = (lines = []) =>
  lines
    .filter((line) => line.productId)
    .map((line) => ({
      productId: line.productId,
      description: line.description || "",
      qtyOrdered: toNumberOrDefault(line.qtyOrdered ?? line.qty, 0),
      qtyDone: toNumberOrDefault(line.qtyDone, 0),
      uom: line.uom || "units",
      toLocationId: line.toLocationId || undefined,
    }));

export default function ReceiptFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = !id || id === "new" || id === "undefined";
  useDocumentTitle(isNew ? "New Receipt" : `Receipt ${id}`);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();
  const [lines, setLines] = useState([]);
  const [status, setStatus] = useState("draft");
  const [showCancel, setShowCancel] = useState(false);

  const { data: receipt, isLoading: fetchLoading } = useQuery({
    queryKey: ["receipt", id],
    queryFn: () =>
      receiptService.getById(id).then((r) => r.data?.data || r.data),
    enabled: !isNew,
  });

  useEffect(() => {
    if (receipt) {
      reset({
        reference: receipt.reference,
        supplier: receipt.supplier || receipt.supplierOrCustomer,
        scheduledDate: receipt.scheduledDate?.split("T")[0],
        sourceDocument: receipt.sourceDocument,
      });
      setLines(receipt.moveLines || receipt.lines || receipt.items || []);
      setStatus(receipt.status || "draft");
    } else if (isNew) {
      reset({
        reference: previewRef("IN"),
        supplier: "",
        scheduledDate: new Date().toISOString().split("T")[0],
        sourceDocument: "",
        notes: "",
      });
    }
  }, [receipt, isNew, reset]);

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (!isNew && !id) {
        throw new Error("Receipt id is missing for update");
      }
      return isNew
        ? receiptService.create(data)
        : receiptService.update(id, data);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      toast.success("Receipt saved");
      const created = res.data?.data || res.data;
      const newId = created?._id || created?.id || id;
      if (isNew) navigate(`/operations/receipts/${newId}`, { replace: true });
    },
    onError: (err) => toast.error(err.response?.data?.message || "Save failed"),
  });

  const validateMutation = useMutation({
    mutationFn: () => receiptService.validate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      queryClient.invalidateQueries({ queryKey: ["receipt", id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-kpis"] });
      queryClient.invalidateQueries({ queryKey: ["moves"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Receipt validated! Stock has been updated.");
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || "Validation failed"),
  });

  const cancelMutation = useMutation({
    mutationFn: () => receiptService.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      queryClient.invalidateQueries({ queryKey: ["receipt", id] });
      toast.success("Receipt cancelled");
      setShowCancel(false);
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || "Cancel failed"),
  });

  const returnMutation = useMutation({
    mutationFn: () => receiptService.return_(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      queryClient.invalidateQueries({ queryKey: ["receipt", id] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Return processed. Stock reversed.");
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || "Return failed"),
  });

  const onSave = (formData) => {
    const moveLines = (lines || []).map((line) => ({
      productId: line.productId,
      description: line.description || "",
      qtyOrdered: Number(line.qty || line.qtyOrdered || 0),
      qtyDone: Number(line.qtyDone || 0),
      uom: line.uom || "units",
      toLocationId: line.toLocationId || null,
    }));

    const payload = {
      reference: formData.reference,
      supplierOrCustomer: formData.supplier,
      scheduledDate: formData.scheduledDate,
      sourceDocument: formData.sourceDocument,
      status: "draft",
      moveLines,
    };

    saveMutation.mutate(payload);
  };

  const isReadOnly = status === "done" || status === "cancelled";

  if (fetchLoading && !isNew) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isNew ? "New Receipt" : receipt?.reference || "Receipt"}
        </h1>
        <div className="flex items-center gap-3">
          {status === "draft" && (
            <>
              <Button
                variant="secondary"
                onClick={() => navigate("/operations/receipts")}
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
          {(status === "waiting" || status === "ready") && (
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
          {status === "done" && (
            <Button
              variant="secondary"
              onClick={() => returnMutation.mutate()}
              loading={returnMutation.isPending}
            >
              Return
            </Button>
          )}
          {status === "cancelled" && (
            <Button
              variant="secondary"
              onClick={() => navigate("/operations/receipts")}
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
              placeholder="e.g. WH/IN/00001"
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
              Supplier *
            </label>
            <input
              {...register("supplier", { required: "Supplier is required" })}
              className="input-field"
              placeholder="Supplier / vendor name"
              disabled={isReadOnly}
            />
            {errors.supplier && (
              <p className="text-xs text-red-500 mt-1">
                {errors.supplier.message}
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
              Source Document
            </label>
            <input
              {...register("sourceDocument")}
              className="input-field"
              placeholder="PO number or reference"
              disabled={isReadOnly}
            />
          </div>
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

      {/* Product Lines */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          Product Lines
        </h2>
        <div className="text-sm text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2 mb-3">
          Select the <strong>destination location</strong> for each product line
          — stock will be added there when you validate.
        </div>
        <LineItemTable
          lines={lines}
          onChange={setLines}
          readOnly={isReadOnly}
          showLocation={true}
          locationField="toLocationId"
          locationLabel="Destination Location"
        />
      </div>

      <ConfirmDialog
        isOpen={showCancel}
        onClose={() => setShowCancel(false)}
        onConfirm={() => cancelMutation.mutate()}
        title="Cancel Receipt"
        message="Are you sure you want to cancel this receipt? This action cannot be undone."
        confirmLabel="Cancel Receipt"
        loading={cancelMutation.isPending}
      />
    </div>
  );
}
