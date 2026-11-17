"use client";

import { useState, useEffect } from "react";
import {
  Package,
  AlertTriangle,
  ArrowRightLeft,
  Scissors,
  Search,
  X,
  Plus,
  Pencil,
} from "lucide-react";
import { formatCurrencyRD } from "@/lib/money";
import { DEFAULT_MEAT_ICON_ID, MeatBadge } from "@/lib/icons/meat-icons";
import { MeatIconPicker, MeatIconPickerModal } from "@/app/components/MeatIconPicker";

interface Product {
  id: string;
  code: string;
  name: string;
  categoryId?: string;
  unit: string;
  allowsDecimals: boolean;
  price: string;
  cost: string;
  minStock: string;
  targetStock: string;
  currentStock: string;
  iconId?: string;
  autoPurchaseOrder: boolean;
}

interface StockAlert {
  productId: string;
  productCode: string;
  productName: string;
  currentStock: string;
  minStock: string;
  targetStock: string;
  suggestedQty: string;
  autoPurchaseOrder: boolean;
}

export default function InventarioPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [productForm, setProductForm] = useState({
    code: "",
    name: "",
    categoryId: "",
    unit: "kg",
    allowsDecimals: true,
    price: "",
    cost: "",
    minStock: "0",
    targetStock: "0",
    autoPurchaseOrder: false,
    iconId: DEFAULT_MEAT_ICON_ID,
  });

  // Modales
  const [isMermaModalOpen, setIsMermaModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [iconAssignProduct, setIconAssignProduct] = useState<Product | null>(null);
  const [isSavingIcon, setIsSavingIcon] = useState(false);

  // Form states para Merma
  const [mermaProduct, setMermaProduct] = useState("");
  const [mermaQty, setMermaQty] = useState("");
  const [mermaReason, setMermaReason] = useState("Desposte / Pérdida por hueso y cartílago");

  // Form states para Traslado
  const [transferProduct, setTransferProduct] = useState("");
  const [transferQty, setTransferQty] = useState("");
  const [fromLoc, setFromLoc] = useState("loc-001"); // Cámara fría
  const [toLoc, setToLoc] = useState("loc-003"); // Mostrador

  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchInventory = () => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => {
        if (data.products) setProducts(data.products);
        if (data.categories) setCategories(data.categories);
        if (data.locations) setLocations(data.locations);
        if (data.alerts) setAlerts(data.alerts);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const openProductForm = (product?: Product) => {
    setEditingProduct(product || null);
    setProductError(null);
    setProductForm({
      code: product?.code || "",
      name: product?.name || "",
      categoryId: product?.categoryId || categories[0]?.id || "",
      unit: product?.unit || "kg",
      allowsDecimals: product?.allowsDecimals ?? true,
      price: product?.price || "",
      cost: product?.cost || "",
      minStock: product?.minStock || "0",
      targetStock: product?.targetStock || "0",
      autoPurchaseOrder: product?.autoPurchaseOrder ?? false,
      iconId: product?.iconId || DEFAULT_MEAT_ICON_ID,
    });
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async () => {
    setProductError(null);
    if (!productForm.code.trim() || !productForm.name.trim()) {
      setProductError("El código y el nombre del producto son obligatorios.");
      return;
    }
    if (!productForm.price || Number(productForm.price) < 0 || Number(productForm.cost) < 0) {
      setProductError("Indica un precio de venta válido y un costo igual o mayor que cero.");
      return;
    }

    try {
      setIsSavingProduct(true);
      const response = await fetch("/api/products", {
        method: editingProduct ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...productForm,
          id: editingProduct?.id,
          initialStock: "0",
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo guardar el producto.");
      setIsProductModalOpen(false);
      setEditingProduct(null);
      fetchInventory();
    } catch (error) {
      setProductError(error instanceof Error ? error.message : "No se pudo guardar el producto.");
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleAssignIcon = async (iconId: string) => {
    if (!iconAssignProduct) return;
    try {
      setIsSavingIcon(true);
      setActionError(null);
      const response = await fetch("/api/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...iconAssignProduct,
          iconId,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo asignar el icono.");
      setIconAssignProduct(null);
      fetchInventory();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "No se pudo asignar el icono.");
    } finally {
      setIsSavingIcon(false);
    }
  };

  // Registrar Merma
  const handleSaveMerma = async () => {
    try {
      setIsSubmitting(true);
      setActionError(null);
      if (!mermaProduct) {
        setActionError("Seleccione un producto");
        return;
      }
      if (!mermaQty || parseFloat(mermaQty) <= 0) {
        setActionError("La cantidad debe ser mayor a cero");
        return;
      }
      if (!mermaReason.trim()) {
        setActionError("El motivo de la merma es obligatorio");
        return;
      }

      const res = await fetch("/api/inventory/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "MERMA",
          productId: mermaProduct,
          quantity: mermaQty,
          reason: mermaReason,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error registrando la merma");
      }

      setIsMermaModalOpen(false);
      setMermaQty("");
      fetchInventory();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "No se pudo registrar la merma.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Registrar Traslado
  const handleSaveTransfer = async () => {
    try {
      setIsSubmitting(true);
      setActionError(null);
      if (!transferProduct) {
        setActionError("Seleccione un producto");
        return;
      }
      if (!transferQty || parseFloat(transferQty) <= 0) {
        setActionError("La cantidad debe ser mayor a cero");
        return;
      }
      if (fromLoc === toLoc) {
        setActionError("La ubicación origen y destino no pueden ser la misma");
        return;
      }

      const res = await fetch("/api/inventory/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "TRASLADO",
          productId: transferProduct,
          fromLocationId: fromLoc,
          toLocationId: toLoc,
          quantity: transferQty,
          reason: "Traslado a mostrador para venta",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al realizar el traslado");
      }

      setIsTransferModalOpen(false);
      setTransferQty("");
      fetchInventory();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "No se pudo realizar el traslado.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Valor total del inventario en costo
  const totalValuation = products.reduce((acc, p) => {
    return acc + parseFloat(p.currentStock || "0") * parseFloat(p.cost || "0");
  }, 0);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <Package className="w-7 h-7 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Inventario & Mermas</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Control de stock al gramo · Ubicaciones · Desposte y mermas por corte
            </p>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => openProductForm()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#176b5d] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#12584d]"
          >
            <Plus className="h-4 w-4" />
            Nuevo producto
          </button>
          <button
            onClick={() => {
              setActionError(null);
              setIsTransferModalOpen(true);
            }}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
            Traslado de Ubicación
          </button>
          <button
            onClick={() => {
              setActionError(null);
              setIsMermaModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <Scissors className="w-4 h-4 text-rose-600" />
            Registrar Merma / Desposte
          </button>
        </div>
      </div>

      {/* Tarjetas Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Cortes Activos
          </span>
          <span className="text-2xl font-black font-mono text-slate-900 block">{products.length}</span>
          <span className="text-[10px] text-slate-500 font-medium">En catálogo</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Valoración (Costo)
          </span>
          <span className="text-xl font-black font-mono text-emerald-700 block">
            {formatCurrencyRD(totalValuation.toFixed(2))}
          </span>
          <span className="text-[10px] text-slate-500 font-medium">Stock valorizado</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Alertas de Stock Bajo
          </span>
          <span className={`text-2xl font-black font-mono block ${alerts.length > 0 ? "text-rose-600" : "text-emerald-700"}`}>
            {alerts.length}
          </span>
          <span className="text-[10px] text-slate-500 font-medium">Bajo stock mínimo</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Ubicaciones Físicas
          </span>
          <span className="text-2xl font-black font-mono text-slate-900 block">{locations.length}</span>
          <span className="text-[10px] text-slate-500 font-medium">Cámaras y mostrador</span>
        </div>
      </div>

      {/* Alertas de Stock Bajo y Reposición Sugerida (si hay) */}
      {alerts.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-3xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-amber-900 font-extrabold text-sm">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>Alertas de Reposición Automática ({alerts.length} productos requieren pedido)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {alerts.map((al) => (
              <div key={al.productId} className="bg-white p-3 rounded-2xl border border-amber-200/80 shadow-xs text-xs space-y-1">
                <div className="flex justify-between font-bold text-slate-900">
                  <span className="truncate">{al.productName}</span>
                  <span className="font-mono text-[11px] text-slate-400">{al.productCode}</span>
                </div>
                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>Stock Actual:</span>
                  <span className="font-mono font-bold text-rose-600">{al.currentStock} kg</span>
                </div>
                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>Mínimo:</span>
                  <span className="font-mono">{al.minStock} kg</span>
                </div>
                <div className="flex justify-between text-emerald-800 font-bold text-[11px] pt-1 border-t border-slate-100">
                  <span>Pedido Sugerido:</span>
                  <span className="font-mono">{al.suggestedQty} kg</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {actionError && !isMermaModalOpen && !isTransferModalOpen && (
        <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {actionError}
        </p>
      )}

      {/* Tabla de Productos y Stock Actual */}
      <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar en inventario..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <span className="text-xs text-slate-500 font-semibold">{filteredProducts.length} productos listados</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-100">
              <tr>
                <th className="py-2.5 px-3">Código</th>
                <th className="py-2.5 px-3">Producto / Corte</th>
                <th className="py-2.5 px-3">Costo Unit.</th>
                <th className="py-2.5 px-3">Precio Venta</th>
                <th className="py-2.5 px-3">Mínimo</th>
                <th className="py-2.5 px-3">Objetivo</th>
                <th className="py-2.5 px-3 text-right">Stock Actual</th>
                <th className="py-2.5 px-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((p) => {
                const isLow = parseFloat(p.currentStock) <= parseFloat(p.minStock);
                return (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-400">{p.code}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => setIconAssignProduct(p)}
                          title="Asignar icono"
                          className="rounded-xl transition hover:scale-105"
                        >
                          <MeatBadge iconId={p.iconId} size="sm" />
                        </button>
                        <div>
                          <span className="block font-semibold text-slate-900">{p.name}</span>
                          <span className="text-[10px] text-slate-400">{categories.find((category) => category.id === p.categoryId)?.name || "Sin categoría"}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{formatCurrencyRD(p.cost)}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">{formatCurrencyRD(p.price)}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">{p.minStock} {p.unit}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">{p.targetStock} {p.unit}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={`px-2 py-0.5 rounded-md font-mono font-bold text-xs ${
                        isLow ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-emerald-50 text-emerald-800"
                      }`}>
                        {p.currentStock} {p.unit}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => openProductForm(p)}
                        aria-label={`Editar ${p.name}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isProductModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/35 p-3 backdrop-blur-sm">
          <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Catálogo</p>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">{editingProduct ? "Editar producto" : "Crear producto"}</h2>
                <p className="mt-1 text-sm text-slate-500">Identifica cada corte con un icono, sin fotos ni descripciones confusas.</p>
              </div>
              <button type="button" onClick={() => setIsProductModalOpen(false)} aria-label="Cerrar" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            {productError && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">{productError}</p>}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5 text-xs font-semibold text-slate-600">
                Código
                <input value={productForm.code} onChange={(event) => setProductForm({ ...productForm, code: event.target.value })} placeholder="RES-003" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-slate-600">
                Nombre del producto
                <input value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} placeholder="Ej. Bistec de res" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-slate-600">
                Categoría
                <select value={productForm.categoryId} onChange={(event) => setProductForm({ ...productForm, categoryId: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500">
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-slate-600">
                Unidad de venta
                <select value={productForm.unit} onChange={(event) => setProductForm({ ...productForm, unit: event.target.value, allowsDecimals: event.target.value !== "unidad" })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500">
                  <option value="kg">Kilogramo (kg)</option>
                  <option value="lb">Libra (lb)</option>
                  <option value="unidad">Unidad</option>
                </select>
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-slate-600">
                Precio de venta (RD$)
                <input type="number" min="0" step="0.01" value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500" />
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-slate-600">
                Costo (RD$)
                <input type="number" min="0" step="0.01" value={productForm.cost} onChange={(event) => setProductForm({ ...productForm, cost: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500" />
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-slate-600">
                Stock mínimo
                <input type="number" min="0" step="0.001" value={productForm.minStock} onChange={(event) => setProductForm({ ...productForm, minStock: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500" />
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-slate-600">
                Stock objetivo
                <input type="number" min="0" step="0.001" value={productForm.targetStock} onChange={(event) => setProductForm({ ...productForm, targetStock: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500" />
              </label>
            </div>

            <div className="mt-5">
              <MeatIconPicker
                selectedIconId={productForm.iconId}
                productName={productForm.name}
                onSelect={(iconId) => setProductForm({ ...productForm, iconId })}
              />
            </div>
            <label className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-600">
              <input type="checkbox" checked={productForm.autoPurchaseOrder} onChange={(event) => setProductForm({ ...productForm, autoPurchaseOrder: event.target.checked })} className="h-4 w-4 accent-emerald-700" />
              Incluir en las sugerencias de reposición
            </label>

            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button type="button" onClick={() => setIsProductModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button type="button" onClick={handleSaveProduct} disabled={isSavingProduct} className="rounded-xl bg-[#176b5d] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#12584d] disabled:opacity-60">
                {isSavingProduct ? "Guardando..." : editingProduct ? "Guardar cambios" : "Crear producto"}
              </button>
            </div>
          </div>
        </div>
      )}

      {iconAssignProduct && (
        <MeatIconPickerModal
          selectedIconId={iconAssignProduct.iconId || DEFAULT_MEAT_ICON_ID}
          productName={iconAssignProduct.name}
          onClose={() => setIconAssignProduct(null)}
          onSelect={handleAssignIcon}
        />
      )}
      {isSavingIcon && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[95] flex justify-center">
          <span className="rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-lg">
            Guardando icono...
          </span>
        </div>
      )}

      {/* MODAL REGISTRAR MERMA */}
      {isMermaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 w-full max-w-md space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center">
                <Scissors className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Registrar Merma / Desposte</h3>
                <p className="text-xs text-slate-500">Pérdida por corte, grasa, hueso o deshidratación</p>
              </div>
            </div>

            {actionError && (
              <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 text-xs rounded-xl font-semibold">
                {actionError}
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Producto / Corte</label>
              <select
                value={mermaProduct}
                onChange={(e) => setMermaProduct(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none"
              >
                <option value="">Seleccione producto...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Stock: {p.currentStock} {p.unit})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Cantidad de Merma (kg)</label>
              <input
                type="text"
                placeholder="Ej: 1.500"
                value={mermaQty}
                onChange={(e) => setMermaQty(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm font-bold text-slate-900 outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Motivo Obligatorio</label>
              <select
                value={mermaReason}
                onChange={(e) => setMermaReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none"
              >
                <option value="Desposte / Pérdida por hueso y cartílago">Desposte / Pérdida por hueso y cartílago</option>
                <option value="Recorte de exceso de grasa">Recorte de exceso de grasa</option>
                <option value="Pérdida por deshidratación en cámara fría">Pérdida por deshidratación en cámara fría</option>
                <option value="Desecho por vencimiento o merma sanitaria">Desecho por vencimiento o merma sanitaria</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsMermaModalOpen(false)}
                className="flex-1 py-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveMerma}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold shadow-md"
              >
                {isSubmitting ? "Guardando..." : "Confirmar Merma"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TRASLADO ENTRE UBICACIONES */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 w-full max-w-md space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Traslado entre Ubicaciones</h3>
                <p className="text-xs text-slate-500">Mover producto de cámara a mostrador</p>
              </div>
            </div>

            {actionError && (
              <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 text-xs rounded-xl font-semibold">
                {actionError}
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Producto</label>
              <select
                value={transferProduct}
                onChange={(e) => setTransferProduct(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none"
              >
                <option value="">Seleccione producto...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Stock: {p.currentStock} {p.unit})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Desde (Origen)</label>
                <select
                  value={fromLoc}
                  onChange={(e) => setFromLoc(e.target.value)}
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Hacia (Destino)</label>
                <select
                  value={toLoc}
                  onChange={(e) => setToLoc(e.target.value)}
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Cantidad a Mover (kg)</label>
              <input
                type="text"
                placeholder="Ej: 5.000"
                value={transferQty}
                onChange={(e) => setTransferQty(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm font-bold text-slate-900 outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="flex-1 py-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveTransfer}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold shadow-md"
              >
                {isSubmitting ? "Moviendo..." : "Confirmar Traslado"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
