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
  MapPin,
  Check,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { formatCurrencyRD } from "@/lib/money";
import { DEFAULT_MEAT_ICON_ID, MeatBadge } from "@/lib/icons/meat-icons";
import { MeatIconPicker, MeatIconPickerModal } from "@/app/components/MeatIconPicker";
import { ArchiveConfirmModal } from "@/app/components/ArchiveConfirmModal";

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
  status: "ACTIVE" | "INACTIVE";
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

interface Location {
  id: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
}

interface StockByLocation {
  productId: string;
  locationId: string;
  quantity: string;
}

export default function InventarioPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [stockByLocation, setStockByLocation] = useState<StockByLocation[]>([]);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("ALL");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [archiveProduct, setArchiveProduct] = useState<Product | null>(null);
  const [isArchivingProduct, setIsArchivingProduct] = useState(false);
  const [archiveProductError, setArchiveProductError] = useState<string | null>(null);
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
  const [transferPicker, setTransferPicker] = useState<"product" | "origin" | "destination" | null>(null);
  const [transferPickerSearch, setTransferPickerSearch] = useState("");
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [locationDraft, setLocationDraft] = useState("");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [archiveLocation, setArchiveLocation] = useState<Location | null>(null);
  const [isArchivingLocation, setIsArchivingLocation] = useState(false);
  const [archiveLocationError, setArchiveLocationError] = useState<string | null>(null);
  const [isSavingLocation, setIsSavingLocation] = useState(false);
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

  const fetchInventory = async () => {
    try {
      const response = await fetch("/api/products");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo cargar el inventario.");
      if (data.products) setProducts(data.products);
      if (data.categories) setCategories(data.categories);
      if (data.locations) setLocations(data.locations);
      if (data.stockByLocation) setStockByLocation(data.stockByLocation);
      if (data.alerts) setAlerts(data.alerts);
      setInventoryError(null);
    } catch (error) {
      setInventoryError(error instanceof Error ? error.message : "No se pudo cargar el inventario.");
    }
  };

  useEffect(() => {
    let active = true;
    fetch("/api/products")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se pudo cargar el inventario.");
        if (!active) return;
        if (data.products) setProducts(data.products);
        if (data.categories) setCategories(data.categories);
        if (data.locations) setLocations(data.locations);
        if (data.stockByLocation) setStockByLocation(data.stockByLocation);
        if (data.alerts) setAlerts(data.alerts);
      })
      .catch((error: unknown) => {
        if (active) setInventoryError(error instanceof Error ? error.message : "No se pudo cargar el inventario.");
      });
    return () => {
      active = false;
    };
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

  const handleProductArchive = async (product: Product) => {
    try {
      setIsArchivingProduct(true);
      setArchiveProductError(null);
      const response = await fetch(
        `/api/products?id=${encodeURIComponent(product.id)}`,
        { method: "DELETE" },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo archivar el producto.");
      setArchiveProduct(null);
      fetchInventory();
    } catch (error) {
      setArchiveProductError(error instanceof Error ? error.message : "No se pudo archivar el producto.");
    } finally {
      setIsArchivingProduct(false);
    }
  };

  const handleProductRestore = async (product: Product) => {
    try {
      setInventoryError(null);
      const response = await fetch("/api/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...product, status: "ACTIVE" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo restaurar el producto.");
      fetchInventory();
    } catch (error) {
      setInventoryError(error instanceof Error ? error.message : "No se pudo restaurar el producto.");
    }
  };

  const requestProductArchive = (product: Product) => {
    setArchiveProductError(null);
    setArchiveProduct(product);
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
      const availableStock = Number(
        stockByLocation.find((stock) => stock.productId === transferProduct && stock.locationId === fromLoc)?.quantity || "0",
      );
      if (Number(transferQty) > availableStock) {
        setActionError(`La cantidad supera las existencias disponibles en el origen (${availableStock} ${products.find((product) => product.id === transferProduct)?.unit || ""}).`);
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

  const stockByLocationMap = new Map(
    stockByLocation.map((stock) => [`${stock.productId}:${stock.locationId}`, stock.quantity]),
  );
  const getLocationStock = (productId: string, locationId: string) =>
    stockByLocationMap.get(`${productId}:${locationId}`) || "0.000";
  const activeLocations = locations.filter((location) => location.status === "ACTIVE");
  const visibleProducts = filteredProducts.filter(
    (product) =>
      selectedLocationId === "ALL" ||
      product.status === "INACTIVE" ||
      Number(getLocationStock(product.id, selectedLocationId)) > 0,
  );

  const openTransferModal = () => {
    const active = locations.filter((location) => location.status === "ACTIVE");
    const origin = active.find((location) => location.id === fromLoc) || active[0];
    const destination =
      active.find((location) => location.id === toLoc && location.id !== origin?.id) ||
      active.find((location) => location.id !== origin?.id);

    setFromLoc(origin?.id || "");
    setToLoc(destination?.id || "");
    setTransferProduct("");
    setTransferQty("");
    setActionError(null);
    setIsTransferModalOpen(true);
  };

  const openTransferPicker = (picker: "product" | "origin" | "destination") => {
    setTransferPickerSearch("");
    setTransferPicker(picker);
  };

  const handleSaveLocation = async () => {
    const name = locationDraft.trim();
    if (!name) {
      setLocationError("El nombre de la ubicación es obligatorio.");
      return;
    }

    try {
      setIsSavingLocation(true);
      setLocationError(null);
      const editingLocation = locations.find((location) => location.id === editingLocationId);
      const response = await fetch("/api/inventory/locations", {
        method: editingLocation ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingLocation
            ? { id: editingLocation.id, name, status: editingLocation.status }
            : { name },
        ),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo guardar la ubicación.");

      setEditingLocationId(null);
      setLocationDraft("");
      fetchInventory();
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : "No se pudo guardar la ubicación.");
    } finally {
      setIsSavingLocation(false);
    }
  };

  const handleArchiveLocation = async (location: Location) => {
    try {
      setIsArchivingLocation(true);
      setArchiveLocationError(null);
      const response = await fetch(`/api/inventory/locations?id=${encodeURIComponent(location.id)}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo archivar la ubicación.");
      setArchiveLocation(null);
      if (selectedLocationId === location.id) setSelectedLocationId("ALL");
      fetchInventory();
    } catch (error) {
      setArchiveLocationError(error instanceof Error ? error.message : "No se pudo archivar la ubicación.");
    } finally {
      setIsArchivingLocation(false);
    }
  };

  const handleRestoreLocation = async (location: Location) => {
    try {
      setLocationError(null);
      const response = await fetch("/api/inventory/locations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: location.id, name: location.name, status: "ACTIVE" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo restaurar la ubicación.");
      fetchInventory();
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : "No se pudo restaurar la ubicación.");
    }
  };

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
            onClick={openTransferModal}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
            Traslado de Ubicación
          </button>
          <button
            type="button"
            onClick={() => {
              setLocationError(null);
              setIsLocationModalOpen(true);
            }}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <MapPin className="w-4 h-4 text-sky-700" />
            Gestionar ubicaciones
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

        {inventoryError && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {inventoryError}
          </p>
        )}
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
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedLocationId("ALL")}
            className={`shrink-0 rounded-xl border px-3 py-2 text-left transition-all ${
              selectedLocationId === "ALL"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
            }`}
          >
            <span className="block text-xs font-extrabold">Todas las ubicaciones</span>
            <span className={`block text-[10px] ${selectedLocationId === "ALL" ? "text-slate-300" : "text-slate-500"}`}>
              {products.length} productos
            </span>
          </button>
          {activeLocations.map((location) => {
            const productsInLocation = products.filter(
              (product) => Number(getLocationStock(product.id, location.id)) > 0,
            ).length;
            const isSelected = selectedLocationId === location.id;
            return (
              <button
                key={location.id}
                type="button"
                onClick={() => setSelectedLocationId(location.id)}
                className={`shrink-0 rounded-xl border px-3 py-2 text-left transition-all ${
                  isSelected
                    ? "border-emerald-700 bg-emerald-700 text-white"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-200 hover:bg-white"
                }`}
              >
                <span className="block max-w-48 truncate text-xs font-extrabold">{location.name}</span>
                <span className={`block text-[10px] ${isSelected ? "text-emerald-100" : "text-slate-500"}`}>
                  {productsInLocation} productos con stock
                </span>
              </button>
            );
          })}
        </div>

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
          <span className="text-xs text-slate-500 font-semibold">{visibleProducts.length} productos listados</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-100">
              <tr>
                <th className="py-2.5 px-3">Código</th>
                <th className="py-2.5 px-3">Producto / Corte</th>
                <th className="py-2.5 px-3">Costo Unit.</th>
                <th className="py-2.5 px-3">Precio Venta</th>
                <th className="py-2.5 px-3 text-right">
                  {selectedLocationId === "ALL"
                    ? "Existencia total"
                    : `Existencia en ${locations.find((location) => location.id === selectedLocationId)?.name}`}
                </th>
                <th className="py-2.5 px-3">Mínimo</th>
                <th className="py-2.5 px-3">Objetivo</th>
                <th className="py-2.5 px-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleProducts.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-12 text-center">
                    <p className="text-sm font-bold text-slate-700">
                      {selectedLocationId === "ALL"
                        ? "No se encontraron productos."
                        : "No hay productos con existencias en esta ubicación."}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Prueba otro filtro o revisa las ubicaciones activas.
                    </p>
                  </td>
                </tr>
              )}
              {visibleProducts.map((p) => {
                const currentStock = selectedLocationId === "ALL"
                  ? p.currentStock
                  : getLocationStock(p.id, selectedLocationId);
                const isLow = parseFloat(currentStock) <= parseFloat(p.minStock);
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
                          {p.status === "INACTIVE" && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">Archivado</span>}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{formatCurrencyRD(p.cost)}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">{formatCurrencyRD(p.price)}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={`px-2 py-0.5 rounded-md font-mono font-bold text-xs ${
                        isLow ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-emerald-50 text-emerald-800"
                      }`}>
                        {currentStock} {p.unit}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">{p.minStock} {p.unit}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">{p.targetStock} {p.unit}</td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openProductForm(p)}
                          aria-label={`Editar ${p.name}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => p.status === "ACTIVE" ? requestProductArchive(p) : void handleProductRestore(p)}
                          aria-label={`${p.status === "ACTIVE" ? "Eliminar" : "Restaurar"} ${p.name}`}
                          title={p.status === "ACTIVE" ? "Eliminar (archivar)" : "Restaurar producto"}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-800"
                        >
                          {p.status === "ACTIVE" ? <Trash2 className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
                          {p.status === "ACTIVE" ? "Eliminar" : "Restaurar"}
                        </button>
                      </div>
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
              <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5">
                <span className="block text-xs font-semibold text-sky-900">Existencia actual total</span>
                <span className="mt-1 block font-mono text-sm font-bold text-sky-950">
                  {editingProduct?.currentStock ?? "0.000"} {productForm.unit}
                </span>
                <span className="mt-1 block text-[10px] text-sky-800">
                  Se modifica con entradas, traslados o mermas; no editando el producto.
                </span>
              </div>
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
      {archiveProduct?.status === "ACTIVE" && (
        <ArchiveConfirmModal
          key={archiveProduct.id}
          title="Archivar producto"
          entityLabel="Producto"
          entityName={`${archiveProduct.code} — ${archiveProduct.name}`}
          description="El producto dejará de aparecer en el punto de venta. Su historial de ventas y movimientos se conservará; puedes restaurarlo después."
          blockedReason={
            Number(archiveProduct.currentStock) !== 0 ||
            stockByLocation.some((stock) => stock.productId === archiveProduct.id && Number(stock.quantity) !== 0)
              ? `No se puede archivar porque todavía tiene ${archiveProduct.currentStock} ${archiveProduct.unit} en existencia. Traslada o ajusta el stock antes de intentarlo de nuevo.`
              : undefined
          }
          error={archiveProductError}
          isSubmitting={isArchivingProduct}
          onClose={() => {
            if (!isArchivingProduct) {
              setArchiveProduct(null);
              setArchiveProductError(null);
            }
          }}
          onConfirm={() => void handleProductArchive(archiveProduct)}
        />
      )}
      {isSavingIcon && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[95] flex justify-center">
          <span className="rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-lg">
            Guardando icono...
          </span>
        </div>
      )}

      {isLocationModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-3 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="location-modal-title"
            className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/80 bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-slate-200/70 bg-slate-50/80 p-5 sm:p-6">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">Inventario</span>
                <h2 id="location-modal-title" className="mt-1 text-xl font-black text-slate-900">Gestionar ubicaciones</h2>
                <p className="mt-1 text-xs text-slate-500">Organiza las cámaras, congeladores y mostradores del inventario.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsLocationModalOpen(false);
                  setEditingLocationId(null);
                  setLocationDraft("");
                }}
                aria-label="Cerrar gestión de ubicaciones"
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-200/70 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                <label htmlFor="location-name" className="mb-2 block text-xs font-extrabold text-slate-700">
                  {editingLocationId ? "Editar nombre de ubicación" : "Agregar ubicación"}
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="location-name"
                    value={locationDraft}
                    onChange={(event) => setLocationDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") handleSaveLocation();
                    }}
                    placeholder="Ej. Cámara fría secundaria"
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                  <div className="flex gap-2">
                    {editingLocationId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingLocationId(null);
                          setLocationDraft("");
                          setLocationError(null);
                        }}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                      >
                        Cancelar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSaveLocation}
                      disabled={isSavingLocation}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-extrabold text-white transition hover:bg-emerald-800 disabled:opacity-50"
                    >
                      {editingLocationId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      {isSavingLocation ? "Guardando..." : editingLocationId ? "Guardar" : "Agregar"}
                    </button>
                  </div>
                </div>
                {locationError && (
                  <p role="alert" className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                    {locationError}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Ubicaciones registradas</h3>
                  <span className="text-[11px] font-semibold text-slate-400">{locations.length} en total</span>
                </div>
                {locations.map((location) => {
                  const stockedProductCount = products.filter(
                    (product) => Number(getLocationStock(product.id, location.id)) !== 0,
                  ).length;

                  return (
                    <div
                      key={location.id}
                      className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 sm:flex-row sm:items-center"
                    >
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        location.status === "ACTIVE" ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-400"
                      }`}>
                        <MapPin className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-extrabold text-slate-900">{location.name}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {stockedProductCount} productos con existencias
                          {stockedProductCount > 0 && location.status === "ACTIVE"
                            ? " · traslada el stock para poder desactivarla"
                            : ""}
                        </p>
                      </div>
                      <span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
                        location.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}>
                        {location.status === "ACTIVE" ? "Activa" : "Inactiva"}
                      </span>
                      <div className="flex gap-2 sm:ml-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingLocationId(location.id);
                            setLocationDraft(location.name);
                            setLocationError(null);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => location.status === "ACTIVE"
                            ? (setArchiveLocationError(null), setArchiveLocation(location))
                            : void handleRestoreLocation(location)}
                          disabled={isSavingLocation}
                          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {location.status === "ACTIVE" ? "Eliminar" : "Restaurar"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-500">
                Las ubicaciones con existencias no pueden archivarse. Las archivadas se conservan para respetar el historial de movimientos y no aparecen en los filtros ni en nuevos traslados.
              </p>
            </div>
          </section>
        </div>
      )}

      {archiveLocation?.status === "ACTIVE" && (
        <ArchiveConfirmModal
          key={archiveLocation.id}
          title="Archivar ubicación"
          entityLabel="Ubicación"
          entityName={archiveLocation.name}
          description="La ubicación se conservará en el historial, pero dejará de estar disponible para traslados y nuevos movimientos."
          blockedReason={
            archiveLocation.id === "loc-003"
              ? "Esta es la ubicación predeterminada de ventas y no se puede archivar."
              : products.some((product) => Number(getLocationStock(product.id, archiveLocation.id)) !== 0)
                ? "Esta ubicación todavía tiene existencias. Trasládalas a otra ubicación antes de archivarla."
                : undefined
          }
          error={archiveLocationError}
          isSubmitting={isArchivingLocation}
          onClose={() => {
            if (!isArchivingLocation) {
              setArchiveLocation(null);
              setArchiveLocationError(null);
            }
          }}
          onConfirm={() => void handleArchiveLocation(archiveLocation)}
        />
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-sm"
          onClick={() => setIsTransferModalOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="transfer-modal-title"
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-lg space-y-5 rounded-3xl border border-white/80 bg-white p-5 shadow-2xl sm:p-6"
          >
            <header className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <ArrowRightLeft className="h-5 w-5" />
                </div>
                <div>
                  <h3 id="transfer-modal-title" className="font-extrabold text-slate-900">Traslado de inventario</h3>
                  <p className="mt-0.5 text-xs text-slate-500">Elige el producto y las ubicaciones.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                aria-label="Cerrar traslado"
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            {actionError && (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                {actionError}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">Producto</label>
              <button
                type="button"
                onClick={() => openTransferPicker("product")}
                aria-haspopup="dialog"
                className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-emerald-300 hover:bg-white"
              >
                {transferProduct && products.find((product) => product.id === transferProduct) ? (
                  <>
                    <MeatBadge
                      iconId={products.find((product) => product.id === transferProduct)?.iconId}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-extrabold text-slate-900">
                        {products.find((product) => product.id === transferProduct)?.name}
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        Disponible en origen: {getLocationStock(transferProduct, fromLoc)} {products.find((product) => product.id === transferProduct)?.unit}
                      </span>
                    </span>
                  </>
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-400">
                    <Package className="h-4 w-4" />
                  </span>
                )}
                {(!transferProduct || !products.find((product) => product.id === transferProduct)) && (
                  <span className="flex-1 text-xs font-semibold text-slate-500">Buscar producto con existencias</span>
                )}
                <span className="text-[11px] font-bold text-emerald-700">Elegir</span>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">Desde · Origen</label>
                <button
                  type="button"
                  onClick={() => openTransferPicker("origin")}
                  disabled={activeLocations.length < 2}
                  aria-haspopup="dialog"
                  className="flex min-h-12 w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-bold text-slate-800 hover:border-emerald-300 disabled:opacity-50"
                >
                  <MapPin className="h-4 w-4 shrink-0 text-emerald-700" />
                  <span className="flex-1 truncate">{locations.find((location) => location.id === fromLoc)?.name || "Elegir origen"}</span>
                  <span className="text-[10px] font-extrabold text-emerald-700">Cambiar</span>
                </button>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">Hacia · Destino</label>
                <button
                  type="button"
                  onClick={() => openTransferPicker("destination")}
                  disabled={activeLocations.length < 2}
                  aria-haspopup="dialog"
                  className="flex min-h-12 w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-bold text-slate-800 hover:border-emerald-300 disabled:opacity-50"
                >
                  <MapPin className="h-4 w-4 shrink-0 text-sky-700" />
                  <span className="flex-1 truncate">{locations.find((location) => location.id === toLoc)?.name || "Elegir destino"}</span>
                  <span className="text-[10px] font-extrabold text-emerald-700">Cambiar</span>
                </button>
              </div>
            </div>

            {activeLocations.length < 2 && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                Activa al menos dos ubicaciones para registrar un traslado.
              </p>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                Cantidad a mover ({products.find((product) => product.id === transferProduct)?.unit || "unidad"})
              </label>
              <input
                type="text"
                placeholder="Ej. 5.000"
                value={transferQty}
                onChange={(e) => setTransferQty(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
              {transferProduct && (
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Stock disponible en {locations.find((location) => location.id === fromLoc)?.name || "el origen"}:{" "}
                  <span className="font-mono font-bold text-slate-700">
                    {getLocationStock(transferProduct, fromLoc)} {products.find((product) => product.id === transferProduct)?.unit}
                  </span>
                </p>
              )}
            </div>

            <div className="flex gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="flex-1 rounded-xl border border-slate-200 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveTransfer}
                disabled={isSubmitting || !transferProduct || activeLocations.length < 2}
                className="flex-1 rounded-xl bg-emerald-700 py-3 text-xs font-extrabold text-white shadow-md transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "Moviendo..." : "Confirmar Traslado"}
              </button>
            </div>
          </section>
        </div>
      )}

      {transferPicker && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-sm"
          onClick={() => setTransferPicker(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="transfer-picker-title"
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[82vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/80 bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-slate-200/70 bg-slate-50/80 p-5">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">Traslado</span>
                <h3 id="transfer-picker-title" className="mt-1 text-lg font-black text-slate-900">
                  {transferPicker === "product"
                    ? "Seleccionar producto"
                    : transferPicker === "origin"
                    ? "Seleccionar origen"
                    : "Seleccionar destino"}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {transferPicker === "product"
                    ? `Productos con existencias en ${locations.find((location) => location.id === fromLoc)?.name || "el origen"}`
                    : "Elige una ubicación activa para este movimiento."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTransferPicker(null)}
                aria-label="Cerrar lista"
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="relative border-b border-slate-100 p-4">
              <Search className="absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                type="search"
                value={transferPickerSearch}
                onChange={(event) => setTransferPickerSearch(event.target.value)}
                placeholder={transferPicker === "product" ? "Buscar producto..." : "Buscar ubicación..."}
                aria-label={transferPicker === "product" ? "Buscar productos" : "Buscar ubicaciones"}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
              {transferPicker === "product" ? (
                products
                  .filter((product) => {
                    const query = transferPickerSearch.trim().toLowerCase();
                    const matchesSearch =
                      product.name.toLowerCase().includes(query) || product.code.toLowerCase().includes(query);
                    return matchesSearch && Number(getLocationStock(product.id, fromLoc)) > 0;
                  })
                  .map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => {
                        setTransferProduct(product.id);
                        setTransferQty("");
                        setActionError(null);
                        setTransferPicker(null);
                      }}
                      className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                        transferProduct === product.id
                          ? "border-emerald-300 bg-emerald-50"
                          : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-slate-50"
                      }`}
                    >
                      <MeatBadge iconId={product.iconId} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-extrabold text-slate-900">{product.name}</span>
                        <span className="text-[10px] font-bold text-slate-400">{product.code}</span>
                      </span>
                      <span className="text-right">
                        <span className="block text-[10px] uppercase tracking-wide text-slate-400">Disponible</span>
                        <span className="block font-mono text-xs font-bold text-emerald-700">
                          {getLocationStock(product.id, fromLoc)} {product.unit}
                        </span>
                      </span>
                    </button>
                  ))
              ) : (
                activeLocations
                  .filter((location) => {
                    const query = transferPickerSearch.trim().toLowerCase();
                    const allowed =
                      transferPicker === "origin"
                        ? location.id !== toLoc
                        : location.id !== fromLoc;
                    return allowed && location.name.toLowerCase().includes(query);
                  })
                  .map((location) => (
                    <button
                      key={location.id}
                      type="button"
                      onClick={() => {
                        if (transferPicker === "origin") {
                          setFromLoc(location.id);
                          if (transferProduct && Number(getLocationStock(transferProduct, location.id)) <= 0) {
                            setTransferProduct("");
                            setTransferQty("");
                          }
                        } else {
                          setToLoc(location.id);
                        }
                        setActionError(null);
                        setTransferPicker(null);
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-emerald-200 hover:bg-slate-50"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                        <MapPin className="h-5 w-5" />
                      </span>
                      <span className="flex-1 truncate text-sm font-bold text-slate-800">{location.name}</span>
                      <span className="text-[10px] font-black uppercase tracking-wide text-emerald-700">
                        {location.id === fromLoc ? "Origen actual" : location.id === toLoc ? "Destino actual" : "Elegir"}
                      </span>
                    </button>
                  ))
              )}

              {transferPicker === "product" &&
                products.filter(
                  (product) =>
                    Number(getLocationStock(product.id, fromLoc)) > 0 &&
                    (product.name.toLowerCase().includes(transferPickerSearch.trim().toLowerCase()) ||
                      product.code.toLowerCase().includes(transferPickerSearch.trim().toLowerCase())),
                ).length === 0 && (
                  <p className="py-8 text-center text-sm font-semibold text-slate-500">
                    No hay productos con existencias que coincidan en esta ubicación.
                  </p>
                )}
              {transferPicker !== "product" &&
                activeLocations.filter((location) => location.id !== (transferPicker === "origin" ? toLoc : fromLoc)).length === 0 && (
                  <p className="py-8 text-center text-sm font-semibold text-slate-500">
                    No hay otra ubicación activa disponible para este traslado.
                  </p>
                )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
