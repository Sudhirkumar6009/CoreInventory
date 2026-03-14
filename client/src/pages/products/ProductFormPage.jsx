import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productService } from "../../api/productService";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import Button from "../../components/common/Button";
import Spinner from "../../components/common/Spinner";
import { UOM_OPTIONS } from "../../constants";
import toast from "react-hot-toast";

const toNumberOrDefault = (value, fallback = 0) => {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(String(value).replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const buildProductPayload = (formData = {}, isNew = false) => {
  const payload = {
    ...formData,
    category: formData.category || null,
    unitOfMeasure: formData.unitOfMeasure || "units",
    perUnitCost: toNumberOrDefault(formData.perUnitCost, 0),
    reorderPoint: toNumberOrDefault(formData.reorderPoint, 0),
    maxStock: toNumberOrDefault(formData.maxStock, 0),
  };

  if (isNew) {
    payload.initialStock = toNumberOrDefault(formData.initialStock, 0);
  }

  return payload;
};

export default function ProductFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = !id || id === "new";
  useDocumentTitle(isNew ? "New Product" : "Edit Product");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: () =>
      productService.getById(id).then((r) => r.data?.data || r.data),
    enabled: !isNew,
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () =>
      productService.getCategories().then((r) => r.data?.data || []),
  });

  useEffect(() => {
    if (product) {
      reset({
        name: product.name,
        sku: product.sku || product.code,
        categoryId: product.categoryId?._id || product.categoryId || "",
        uom: product.uom || "units",
        perUnitCost: product.perUnitCost ?? 0,
      });
    } else if (isNew) {
      reset({
        name: "",
        sku: "",
        categoryId: "",
        uom: "units",
        perUnitCost: 0,
        initialStock: 0,
      });
    }
  }, [product, isNew, reset]);

  const onSubmit = (data) => {
    const payload = {
      name: data.name,
      sku: data.sku,
      categoryId: data.categoryId,
      uom: data.uom,
    };

    if (isNew && data.initialStock !== undefined && data.initialStock !== "") {
      payload.initialStock = Number(data.initialStock);
    }

    if (isNew && data.initialStock !== undefined && data.initialStock !== "") {
      payload.initialStock = Number(data.initialStock);
    }

    if (!isNew && data.perUnitCost !== undefined && data.perUnitCost !== "") {
      payload.perUnitCost = Number(data.perUnitCost);
    }

    mutation.mutate(payload);
  };

  const mutation = useMutation({
    mutationFn: (data) => {
      const payload = buildProductPayload(data, isNew);
      return isNew
        ? productService.create(payload)
        : productService.update(id, payload);
    },
    onSuccess: (response) => {
      const savedProduct = response?.data?.data || response?.data;

      // Keep visible product list in sync immediately after save.
      queryClient.setQueriesData({ queryKey: ["products"] }, (current) => {
        if (!current || !savedProduct) return current;
        const list = Array.isArray(current.items) ? current.items : [];
        const existingIndex = list.findIndex(
          (item) =>
            (item._id || item.id) === (savedProduct._id || savedProduct.id),
        );

        if (existingIndex >= 0) {
          const updatedItems = [...list];
          updatedItems[existingIndex] = {
            ...updatedItems[existingIndex],
            ...savedProduct,
          };
          return { ...current, items: updatedItems };
        }

        return isNew ? { ...current, items: [savedProduct, ...list] } : current;
      });

      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product", id] });
      toast.success("Product saved");
      navigate("/products");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Save failed"),
  });

  if (isLoading && !isNew)
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isNew ? "New Product" : "Edit Product"}
        </h1>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => navigate("/products")}>
            Discard
          </Button>
          <Button onClick={handleSubmit(onSubmit)} loading={mutation.isPending}>
            Save Product
          </Button>
        </div>
      </div>

      <form className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Name *
            </label>
            <input
              {...register("name", {
                required: "Name is required",
                maxLength: { value: 100, message: "Max 100 chars" },
              })}
              className="input-field"
              placeholder="Product name"
            />
            {errors.name && (
              <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              SKU / Code *
            </label>
            <input
              {...register("sku", {
                required: "SKU is required",
                pattern: {
                  value: /^[a-zA-Z0-9\-_]+$/,
                  message: "Only letters, numbers, - and _",
                },
              })}
              className="input-field"
              placeholder="e.g. STL-ROD-001"
            />
            {errors.sku && (
              <p className="text-xs text-red-500 mt-1">{errors.sku.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Category *
            </label>
            <select
              {...register("categoryId", { required: "Category is required" })}
              className="input-field"
            >
              <option value="">Select category...</option>
              {(categories || []).map((c) => (
                <option key={c._id || c.id} value={c._id || c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.categoryId && (
              <p className="text-xs text-red-500 mt-1">
                {errors.categoryId.message}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Unit of Measure
            </label>
            <select {...register("uom")} className="input-field">
              {UOM_OPTIONS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          {!isNew && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Per Unit Cost
              </label>
              <input
                type="number"
                {...register("perUnitCost", { min: 0 })}
                className="input-field"
                placeholder="0"
                min="0"
                step="0.01"
              />
            </div>
          )}
          {isNew && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Initial Stock (optional)
              </label>
              <input
                type="number"
                {...register("initialStock", { min: 0 })}
                className="input-field"
                placeholder="0"
                min="0"
                step="0.01"
              />
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
