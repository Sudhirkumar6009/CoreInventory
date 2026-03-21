import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { receiptService } from "../../api/receiptService";
import { useAuthStore } from "../../store/authStore";
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
const STATUS_OPTIONS = ["draft", "waiting", "ready", "done", "cancelled"];

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
    toLocationId: line.toLocationId?._id || line.toLocationId || null,
  }));
};

export default function ReceiptFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const { isManager } = useRole();
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
        supplierOrCustomer: receipt.supplierOrCustomer || '',
        responsibleUser: receipt.createdBy?.email || currentUser?.email || '',
        scheduledDate: receipt.scheduledDate?.split('T')[0],
      })
      setLines(normalizeLines(receipt.moveLines || receipt.lines || receipt.items || []))
      setStatus(receipt.status || 'draft')
    } else if (isNew) {
      reset({
        reference: previewRef('IN'),
        supplierOrCustomer: '',
        responsibleUser: currentUser?.email || '',
        scheduledDate: new Date().toISOString().split('T')[0],
      })
    }
  }, [receipt, isNew, reset, currentUser?.email]);

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
      if (created?.status) setStatus(created.status);
      const newId = created?._id || created?.id || id;
      if (isNew && newId)
        navigate(`/operations/receipts/${newId}`, { replace: true });
    },
    onError: (err) => toast.error(err.response?.data?.message || "Save failed"),
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



  const onSave = (formData) => {
    const hasPartialLines = (lines || []).some((line) => {
      const productId = getLineProductId(line);
      const qtyOrdered = Number(line.qty || line.qtyOrdered || 0);
      const hasAnyData =
        !!productId ||
        qtyOrdered > 0 ||
        Number(line.qtyDone || 0) > 0 ||
        !!line.toLocationId;
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
        toLocationId: line.toLocationId || null,
      }))
      .filter((line) => line.productId && line.qtyOrdered > 0);

    saveMutation.mutate({
      reference: formData.reference,
      supplierOrCustomer: formData.supplierOrCustomer,
      scheduledDate: formData.scheduledDate,
      status: isManager ? status : 'draft',
      moveLines,
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

  return (
    <div>
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
              onClick={() => navigate("/operations/receipts")}
            >
              Back to List
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <StatusStepper
          steps={STEPS}
          current={status?.charAt(0).toUpperCase() + status?.slice(1)}
        />
      </div>

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
              Supplier Name *
            </label>
            <input
              {...register("supplierOrCustomer", { required: "Supplier Name is required" })}
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
              Responsible User
            </label>
            <input
              {...register("responsibleUser")}
              className="input-field bg-gray-50"
              placeholder="User email"
              readOnly
            />
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="input-field"
              disabled={!isManager}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </form>

      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          Product Lines
        </h2>
        <div className="text-sm text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2 mb-3">
          Select the <strong>destination location</strong> for each product line
          and product details will be auto-filled from stock or product master
          data.
        </div>
        <LineItemTable
          lines={lines}
          onChange={setLines}
          readOnly={isReadOnly}
          showLocation={true}
          locationField="toLocationId"
          locationLabel="Destination Location"
          hideQtyDone={status !== 'ready' && status !== 'done'}
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
