"use client";

import { useState, useEffect, useRef } from "react";
import {
  Search,
  Barcode,
  Trash2,
  Pause,
  XCircle,
  Scale,
  User,
  ShoppingBag,
  Banknote,
  Sparkles,
  Clock,
  Keyboard,
  ArrowRight,
} from "lucide-react";
import { formatCurrencyRD, calculateLineTotal, sumLineTotals } from "@/lib/money";
import { WeightInputModal } from "@/app/components/WeightInputModal";
import { PaymentModal } from "@/app/components/PaymentModal";
import { ThermalTicketModal } from "@/app/components/ThermalTicketModal";
import { MeatBadge } from "@/lib/icons/meat-icons";

interface CartLine {
  productId: string;
  code: string;
  name: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  discountPct?: string;
  lineTotal: string;
  iconId?: string;
  allowsDecimals: boolean;
}

interface Product {
  id: string;
  code: string;
  name: string;
  categoryId?: string;
  unit: string;
  allowsDecimals: boolean;
  price: string;
  cost: string;
  currentStock: string;
  iconId?: string;
}

interface Customer {
  id: string;
  name: string;
  documentId?: string;
  phone?: string;
  creditLimit: string;
  balance: string;
  status: string;
}

interface CompletedSale {
  number: number;
  createdAt: string | Date;
  customerName?: string;
  paymentType: string;
  total: string;
  paidAmount?: string;
  changeAmount?: string;
  lines: Array<{
    productName: string;
    quantity: string;
    unitPrice: string;
    lineTotal: string;
  }>;
}

export default function PosVentasPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Modales
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);

  // Ref para input de búsqueda y atajos
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Carga inicial de catálogo y clientes
  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => {
        if (data.products) setProducts(data.products);
        if (data.categories) setCategories(data.categories);
      })
      .catch(() => {});

    fetch("/api/customers")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setCustomers(data);
      })
      .catch(() => {});
  }, []);

  // Atajos de teclado para cajeros profesionales (Olive POS / Bitepoint)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // '/' para enfocar el buscador
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // 'F2' para cobrar si el carrito tiene productos
      if (e.key === "F2" && cart.length > 0 && !isWeightModalOpen && !isTicketModalOpen) {
        e.preventDefault();
        setIsPaymentModalOpen(true);
      }
      // 'Escape' para vaciar búsqueda si está enfocada
      if (e.key === "Escape" && document.activeElement === searchInputRef.current) {
        setSearchQuery("");
        searchInputRef.current?.blur();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart.length, isWeightModalOpen, isTicketModalOpen]);

  // Filtrado de productos por categoría y búsqueda
  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategory === "ALL" || p.categoryId === selectedCategory;
    const matchesSearch =
      searchQuery === "" ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  // Cálculo de totales del carrito con exactitud decimal ROUND_HALF_UP
  const subtotalAmount = sumLineTotals(cart.map((c) => c.lineTotal));
  const totalAmount = subtotalAmount;

  // Abrir pesaje para agregar producto
  const handleSelectProduct = (prod: Product) => {
    setModalProduct(prod);
    setIsWeightModalOpen(true);
  };

  // Re-abrir pesaje para una línea existente en el carrito
  const handleEditCartLine = (line: CartLine) => {
    const originalProd = products.find((p) => p.id === line.productId);
    if (originalProd) {
      setModalProduct(originalProd);
      setIsWeightModalOpen(true);
    }
  };

  // Confirmar pesaje y añadir al carrito
  const handleConfirmWeight = (quantity: string, unit: string) => {
    if (!modalProduct) return;

    const lineTotal = calculateLineTotal(quantity, modalProduct.price, modalProduct.allowsDecimals);

    // Verificar si ya está en el carrito
    setCart((prev) => {
      const existingIdx = prev.findIndex((item) => item.productId === modalProduct.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        // En carnicería, sumar peso nuevo al peso anterior
        const newQty = (parseFloat(updated[existingIdx].quantity) + parseFloat(quantity)).toFixed(3);
        const newLineTotal = calculateLineTotal(newQty, modalProduct.price, modalProduct.allowsDecimals);
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: newQty,
          lineTotal: newLineTotal,
        };
        return updated;
      }

      return [
        ...prev,
        {
          productId: modalProduct.id,
          code: modalProduct.code,
          name: modalProduct.name,
          unit,
          quantity,
          unitPrice: modalProduct.price,
          lineTotal,
          iconId: modalProduct.iconId,
          allowsDecimals: modalProduct.allowsDecimals,
        },
      ];
    });
  };

  // Quitar línea del carrito
  const handleRemoveLine = (idx: number) => {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  };

  // Cancelar venta actual
  const handleCancelSale = () => {
    if (cart.length === 0) return;
    if (confirm("¿Está seguro de que desea cancelar la venta actual y vaciar el carrito?")) {
      setCart([]);
      setSelectedCustomer(null);
    }
  };

  // Pausar venta actual
  const handlePauseSale = () => {
    if (cart.length === 0) return;
    alert("Venta pausada y guardada en memoria. Puede atender al siguiente cliente.");
    setCart([]);
  };

  // Procesar cobro final
  const handleCompleteSale = async (params: {
    paymentType: "CONTADO" | "CREDITO";
    paymentMethod: "EFECTIVO" | "TARJETA";
    paidAmount?: string;
    changeAmount?: string;
    supervisorPin?: string;
  }) => {
    const response = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: selectedCustomer?.id,
        paymentType: params.paymentType,
        paymentMethod: params.paymentMethod,
        userId: "user-cajero-1",
        authorizedBy: params.supervisorPin ? "user-supervisor-1" : undefined,
        lines: cart.map((c) => ({
          productId: c.productId,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
        })),
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Fallo al procesar la venta");
    }

    const createdSale: CompletedSale = await response.json();

    // Preparar objeto para ticket térmico
    setCompletedSale({
      ...createdSale,
      customerName: selectedCustomer?.name,
      paidAmount: params.paidAmount,
      changeAmount: params.changeAmount,
    });

    // Vaciar carrito
    setCart([]);
    setSelectedCustomer(null);
    setIsTicketModalOpen(true);
  };

  return (
    <div className="flex-1 min-h-[calc(100vh-4rem)] p-3 sm:p-5 flex flex-col gap-4">
      {/* BARRA SUPERIOR DE CONTROL DE VENTA (Estilo Olive POS con Glassmorfismo) */}
      <div className="glass-panel rounded-3xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        {/* Buscador Rápido y Lector de Código de Barras */}
        <div className="flex-1 min-w-[280px] flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar corte o código (ej. Res, RES-001, Chuleta...) [Presione /]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-white/70 border border-slate-200/80 rounded-2xl text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="button"
            className="p-2.5 rounded-2xl border border-slate-200/80 bg-white/80 hover:bg-white text-slate-700 transition-all shadow-xs cursor-pointer active:scale-95"
            title="Lector óptico de código de barras"
          >
            <Barcode className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Atajos Visuales & Botones de Gestión de Turno */}
        <div className="flex items-center gap-2">
          {/* Badge informativo de atajo F2 */}
          <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/80 text-[11px] font-semibold text-slate-500">
            <Keyboard className="w-3.5 h-3.5 text-slate-400" />
            <span>F2: Cobrar</span>
            <span>•</span>
            <span>/: Buscar</span>
          </div>

          <button
            type="button"
            onClick={handlePauseSale}
            disabled={cart.length === 0}
            className="px-3.5 py-2.5 rounded-2xl text-xs font-black bg-amber-50/80 border border-amber-200/80 text-amber-800 hover:bg-amber-100/80 active:scale-95 disabled:opacity-30 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Pause className="w-4 h-4 text-amber-600" />
            <span>PAUSAR</span>
          </button>

          <button
            type="button"
            onClick={handleCancelSale}
            disabled={cart.length === 0}
            className="px-3.5 py-2.5 rounded-2xl text-xs font-black bg-rose-50/80 border border-rose-200/80 text-rose-800 hover:bg-rose-100/80 active:scale-95 disabled:opacity-30 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <XCircle className="w-4 h-4 text-rose-600" />
            <span>CANCELAR</span>
          </button>
        </div>
      </div>

      {/* GRID PRINCIPAL: CATÁLOGO DE PRODUCTOS (7 COLS) + CARRITO Y COBRO (5 COLS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
        {/* PANEL IZQUIERDO: CATÁLOGO DE CORTES CÁRNICOS (7 COLUMNAS) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          {/* Pestañas de Categoría con Acabado Frosted Glass */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedCategory("ALL")}
              className={`px-4 py-2 rounded-2xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === "ALL"
                  ? "bg-[#0B192C] text-white shadow-md shadow-[#0B192C]/20"
                  : "glass-pill text-slate-600 hover:text-slate-900 hover:bg-white/90"
              }`}
            >
              Todos los Cortes
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-2xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? "bg-[#0B192C] text-white shadow-md shadow-[#0B192C]/20"
                    : "glass-pill text-slate-600 hover:text-slate-900 hover:bg-white/90"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Tarjetas de Producto Táctiles con Meat Icons */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto max-h-[calc(100vh-14.5rem)] pr-1">
            {filteredProducts.map((p) => {
              const stockNum = parseFloat(p.currentStock);
              const isLowStock = stockNum <= 10;
              const isCriticalStock = stockNum <= 5;

              return (
                <div
                  key={p.id}
                  onClick={() => handleSelectProduct(p)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleSelectProduct(p);
                    }
                  }}
                  className="glass-card rounded-3xl p-4 cursor-pointer active:scale-95 transition-all flex flex-col justify-between group relative select-none"
                >
                  <div>
                    {/* Código y Stock */}
                    <div className="flex items-center justify-between gap-1 mb-2.5">
                      <span className="text-[10px] font-black text-slate-400 font-mono tracking-wider">
                        {p.code}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold flex items-center gap-1 ${
                          isCriticalStock
                            ? "bg-rose-100/80 text-rose-800 border border-rose-200"
                            : isLowStock
                            ? "bg-amber-100/80 text-amber-800 border border-amber-200"
                            : "bg-emerald-100/60 text-emerald-800 border border-emerald-200/60"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isCriticalStock
                              ? "bg-rose-500"
                              : isLowStock
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          }`}
                        />
                        {p.currentStock} {p.unit}
                      </span>
                    </div>

                    {/* Icono Cárnico Amigable y Nombre del Producto */}
                    <div className="flex items-center gap-2.5">
                      <MeatBadge iconId={p.iconId} size="md" />
                      <h4 className="line-clamp-2 text-xs sm:text-sm font-black leading-snug text-slate-900 transition-colors group-hover:text-emerald-700">
                        {p.name}
                      </h4>
                    </div>
                  </div>

                  {/* Precio y Botón de Pesar */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100/80 flex items-center justify-between">
                    <div>
                      <span className="text-sm sm:text-base font-black font-mono text-[#0B192C]">
                        {formatCurrencyRD(p.price)}
                      </span>
                      <span className="text-[10px] text-slate-400 block -mt-0.5 font-bold">
                        por {p.unit}
                      </span>
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200/60 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-xs">
                      <Scale className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* PANEL DERECHO: CARRITO INTERACTIVO Y COBRO (5 COLUMNAS) */}
        <div className="lg:col-span-5 glass-panel rounded-3xl flex flex-col justify-between overflow-hidden shadow-sm">
          {/* Header del Carrito */}
          <div className="p-4 border-b border-slate-200/60 bg-white/70 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#0B192C] text-white flex items-center justify-center shadow-xs">
                <ShoppingBag className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <span className="font-black text-slate-900 text-sm block leading-tight">
                  TICKET DE VENTA
                </span>
                <span className="text-[11px] text-slate-500 font-medium">Caja Principal</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600 bg-white/80 px-2.5 py-1 rounded-full border border-slate-200/70 shadow-xs">
                {cart.length} líneas
              </span>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors"
                  title="Vaciar carrito"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Tabla de Artículos del Carrito */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-2 max-h-[calc(100vh-26rem)] min-h-[170px]">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                <div className="w-16 h-16 rounded-3xl bg-slate-100/80 flex items-center justify-center mb-3 text-slate-300">
                  <Scale className="w-8 h-8 stroke-1" />
                </div>
                <p className="text-sm font-bold text-slate-700">El carrito está vacío</p>
                <p className="text-xs text-slate-400 max-w-xs mt-0.5">
                  Haga clic en cualquier corte de carne del catálogo para ingresar su peso en la balanza.
                </p>
              </div>
            ) : (
              cart.map((line, idx) => (
                <div
                  key={idx}
                  className="bg-white/80 rounded-2xl p-3 border border-slate-200/70 shadow-xs flex items-center justify-between gap-2.5 transition-all hover:bg-white"
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <MeatBadge iconId={line.iconId} size="sm" />
                    <div className="flex-1 min-w-0">
                      <span className="font-extrabold text-slate-900 text-xs block truncate leading-tight">
                        {line.name}
                      </span>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                        <button
                          type="button"
                          onClick={() => handleEditCartLine(line)}
                          className="font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded hover:bg-emerald-100 transition-colors cursor-pointer"
                          title="Haga clic para cambiar peso"
                        >
                          {line.quantity} {line.unit} ✎
                        </button>
                        <span>×</span>
                        <span className="font-mono font-semibold">{formatCurrencyRD(line.unitPrice)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="font-black font-mono text-slate-900 text-sm">
                      {formatCurrencyRD(line.lineTotal)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveLine(idx)}
                      className="w-7 h-7 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
                      title="Eliminar del ticket"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Selector de Cliente (Estilo Bitepoint) */}
          <div className="p-3.5 border-t border-slate-200/60 bg-white/60">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Cliente de la Venta
              </label>
              {selectedCustomer && (
                <span className="text-[10px] font-black text-amber-800 bg-amber-100/70 px-2 py-0.2 rounded-full border border-amber-200">
                  Deuda: {formatCurrencyRD(selectedCustomer.balance)}
                </span>
              )}
            </div>
            <select
              value={selectedCustomer?.id || ""}
              onChange={(e) => {
                const found = customers.find((c) => c.id === e.target.value);
                setSelectedCustomer(found || null);
              }}
              className="w-full text-xs font-bold py-2.5 px-3 bg-white/90 border border-slate-200/80 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/30 text-slate-800 cursor-pointer shadow-xs"
            >
              <option value="">Cliente Mostrador (Venta Rápida / Contado)</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — Crédito Disp: {formatCurrencyRD(c.creditLimit)} (Deuda: {formatCurrencyRD(c.balance)})
                </option>
              ))}
            </select>
          </div>

          {/* Desglose Financiero & Botón de Cobro (Olive POS / Bitepoint) */}
          <div className="p-4 border-t border-slate-200/70 bg-white/90 space-y-3">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span className="font-mono font-semibold">{formatCurrencyRD(subtotalAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>ITBIS (0% exento en carnes frescas)</span>
                <span className="font-mono font-semibold">RD$ 0.00</span>
              </div>
              <div className="flex justify-between items-baseline pt-2.5 border-t border-slate-200/80">
                <span className="text-base font-black text-slate-900 tracking-tight">TOTAL</span>
                <span className="text-3xl font-black font-mono text-[#0B192C] tracking-tight">
                  {formatCurrencyRD(totalAmount)}
                </span>
              </div>
            </div>

            {/* Botón Principal de Finalizar Venta con Atajo F2 */}
            <button
              type="button"
              onClick={() => setIsPaymentModalOpen(true)}
              disabled={cart.length === 0}
              className="w-full py-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 active:scale-98 disabled:opacity-30 text-white font-black rounded-2xl shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2.5 text-base sm:text-lg uppercase tracking-wide cursor-pointer"
            >
              <Banknote className="w-6 h-6 stroke-[2.5]" />
              <span>COBRAR {formatCurrencyRD(totalAmount)}</span>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-lg ml-1 font-mono">F2</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modales Interactivos de Pesaje, Cobro y Ticket */}
      <WeightInputModal
        key={modalProduct?.id || "no-product"}
        isOpen={isWeightModalOpen}
        onClose={() => setIsWeightModalOpen(false)}
        product={modalProduct}
        onConfirm={handleConfirmWeight}
      />

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        totalAmount={totalAmount}
        items={cart}
        customer={selectedCustomer}
        onCompleteSale={handleCompleteSale}
      />

      <ThermalTicketModal
        isOpen={isTicketModalOpen}
        onClose={() => setIsTicketModalOpen(false)}
        sale={completedSale}
      />
    </div>
  );
}
