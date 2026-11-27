export interface CategoryData {
  id: string;
  name: string;
  createdAt: Date;
}

export const DEFAULT_SALES_LOCATION_ID = "loc-003";

export interface ProductData {
  id: string;
  code: string;
  name: string;
  categoryId?: string;
  unit: string; // "kg", "lb", "unidad"
  allowsDecimals: boolean;
  price: string; // DECIMAL(14,4)
  cost: string; // DECIMAL(14,4)
  minStock: string; // DECIMAL(14,3)
  targetStock: string; // DECIMAL(14,3)
  mainSupplierId?: string;
  autoPurchaseOrder: boolean;
  status: "ACTIVE" | "INACTIVE";
  currentStock: string; // suma de ubicaciones
  iconId?: string; // Icono gráfico amigable para carnicería
  createdAt: Date;
  updatedAt: Date;
}


export interface LocationData {
  id: string;
  name: string;
  parentId?: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt: Date;
}

export interface StockByLocationData {
  productId: string;
  locationId: string;
  quantity: string; // DECIMAL(14,3)
}

export interface InventoryMovementData {
  id: string;
  productId: string;
  fromLocationId?: string;
  toLocationId?: string;
  type: "ENTRADA" | "SALIDA" | "TRASLADO" | "AJUSTE" | "MERMA" | "DEVOLUCION";
  quantity: string; // DECIMAL(14,3)
  unitCost?: string;
  referenceType?: string; // "SALE", "RECEIPT", "MERMA", "VOID"
  referenceId?: string;
  reason?: string;
  clientOpId?: string;
  userId: string;
  authorizedBy?: string;
  createdAt: Date;
}

export interface SaleLineData {
  id: string;
  saleId: string;
  productId: string;
  productName: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
}

export interface SaleData {
  id: string;
  number: number;
  customerId?: string;
  customerName?: string;
  paymentType: "CONTADO" | "CREDITO";
  total: string;
  status: "CONFIRMED" | "VOIDED";
  cashSessionId?: string;
  clientOpId?: string;
  userId: string;
  voidReason?: string;
  voidedBy?: string;
  voidedAt?: Date;
  createdAt: Date;
  lines: SaleLineData[];
}

export interface CustomerData {
  id: string;
  name: string;
  documentId?: string;
  phone?: string;
  address?: string;
  creditLimit: string;
  balance: string; // Saldo deudor actual
  status: "ACTIVE" | "BLOCKED" | "INACTIVE";
  createdAt: Date;
}

export interface CustomerLedgerData {
  id: string;
  customerId: string;
  type: "VENTA" | "ABONO" | "AJUSTE" | "ANULACION";
  amount: string; // positivo incrementa deuda, negativo la reduce
  referenceId?: string;
  note?: string;
  userId: string;
  createdAt: Date;
}

export interface CashSessionData {
  id: string;
  sessionNumber: number;
  userId: string;
  userName: string;
  openingAmount: string;
  expectedAmount: string;
  countedAmount?: string;
  difference?: string;
  diffReason?: string;
  status: "OPEN" | "CLOSED";
  openedAt: Date;
  closedAt?: Date;
  denominationBreakdown?: Record<string, number>;
}

export interface CashMovementData {
  id: string;
  cashSessionId: string;
  type: "VENTA_EFECTIVO" | "ABONO_EFECTIVO" | "INGRESO_MANUAL" | "RETIRO_MANUAL";
  amount: string;
  reason?: string;
  userId: string;
  authorizedBy?: string;
  createdAt: Date;
}

export interface AuditLogData {
  id: string;
  userId: string;
  action: string;
  entity: string;
  entityId?: string;
  beforeState?: unknown;
  afterState?: unknown;
  ipAddress?: string;
  clientOpId?: string;
  authorizedBy?: string;
  createdAt: Date;
}

// Semilla inicial realista para Carnicería dominicana
export function createInitialState() {
  const locCamaraFriaId = "loc-001";
  const locCongeladorId = "loc-002";
  const locMostradorId = DEFAULT_SALES_LOCATION_ID;

  const locations: LocationData[] = [
    { id: locCamaraFriaId, name: "Cámara Fría Principal", status: "ACTIVE", createdAt: new Date() },
    { id: locCongeladorId, name: "Congelador de Reserva", status: "ACTIVE", createdAt: new Date() },
    { id: locMostradorId, name: "Exhibición / Mostrador", status: "ACTIVE", createdAt: new Date() },
  ];

  const categories: CategoryData[] = [
    { id: "cat-res", name: "Carne de Res", createdAt: new Date() },
    { id: "cat-cerdo", name: "Carne de Cerdo", createdAt: new Date() },
    { id: "cat-pollo", name: "Aves y Pollo", createdAt: new Date() },
    { id: "cat-embutidos", name: "Embutidos & Especiales", createdAt: new Date() },
  ];

  const products: ProductData[] = [
    {
      id: "prod-res-01",
      code: "RES-001",
      name: "Carne de Res de Primera (Molleja / Filete)",
      categoryId: "cat-res",
      unit: "kg",
      allowsDecimals: true,
      price: "450.0000",
      cost: "310.0000",
      minStock: "15.000",
      targetStock: "45.000",
      autoPurchaseOrder: true,
      status: "ACTIVE",
      currentStock: "27.500",
      iconId: "carne",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "prod-res-02",
      code: "RES-002",
      name: "Carne Molida Especial de Res",
      categoryId: "cat-res",
      unit: "kg",
      allowsDecimals: true,
      price: "320.0000",
      cost: "210.0000",
      minStock: "10.000",
      targetStock: "30.000",
      autoPurchaseOrder: true,
      status: "ACTIVE",
      currentStock: "18.250",
      iconId: "carne_2",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "prod-cerdo-01",
      code: "CRD-001",
      name: "Chuleta Ahumada de Cerdo",
      categoryId: "cat-cerdo",
      unit: "kg",
      allowsDecimals: true,
      price: "280.0000",
      cost: "185.0000",
      minStock: "12.000",
      targetStock: "35.000",
      autoPurchaseOrder: true,
      status: "ACTIVE",
      currentStock: "14.000",
      iconId: "chuleta",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "prod-cerdo-02",
      code: "CRD-002",
      name: "Costillitas de Cerdo BBQ",
      categoryId: "cat-cerdo",
      unit: "kg",
      allowsDecimals: true,
      price: "310.0000",
      cost: "215.0000",
      minStock: "8.000",
      targetStock: "25.000",
      autoPurchaseOrder: false,
      status: "ACTIVE",
      currentStock: "6.500", // Alerta stock bajo
      iconId: "costillas",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "prod-pollo-01",
      code: "POL-001",
      name: "Pechuga de Pollo Deshuesada",
      categoryId: "cat-pollo",
      unit: "kg",
      allowsDecimals: true,
      price: "180.0000",
      cost: "115.0000",
      minStock: "20.000",
      targetStock: "60.000",
      autoPurchaseOrder: true,
      status: "ACTIVE",
      currentStock: "42.000",
      iconId: "chicken-leg",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "prod-pollo-02",
      code: "POL-002",
      name: "Pollo Entero Limpio",
      categoryId: "cat-pollo",
      unit: "kg",
      allowsDecimals: true,
      price: "110.0000",
      cost: "75.0000",
      minStock: "25.000",
      targetStock: "80.000",
      autoPurchaseOrder: true,
      status: "ACTIVE",
      currentStock: "35.000",
      iconId: "pollo_1",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "prod-emb-01",
      code: "EMB-001",
      name: "Longaniza Criolla Artesanal",
      categoryId: "cat-embutidos",
      unit: "kg",
      allowsDecimals: true,
      price: "240.0000",
      cost: "150.0000",
      minStock: "5.000",
      targetStock: "20.000",
      autoPurchaseOrder: false,
      status: "ACTIVE",
      currentStock: "12.500",
      iconId: "longaniza",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "prod-emb-02",
      code: "EMB-002",
      name: "Salami Especial Mallita (Unidad)",
      categoryId: "cat-embutidos",
      unit: "unidad",
      allowsDecimals: false, // Producto entero no fraccional
      price: "195.0000",
      cost: "135.0000",
      minStock: "10.000",
      targetStock: "30.000",
      autoPurchaseOrder: false,
      status: "ACTIVE",
      currentStock: "19.000",
      iconId: "salami",
      createdAt: new Date(),
      updatedAt: new Date(),
    },

  ];

  const initialLocationStocks: StockByLocationData[] = [
    { productId: "prod-res-01", locationId: locCamaraFriaId, quantity: "15.750" },
    { productId: "prod-res-01", locationId: locCongeladorId, quantity: "8.250" },
    { productId: "prod-res-01", locationId: locMostradorId, quantity: "3.500" },
    { productId: "prod-pollo-01", locationId: locMostradorId, quantity: "20.000" },
    { productId: "prod-pollo-01", locationId: locCamaraFriaId, quantity: "22.000" },
  ];
  const productsWithLocationStock = new Set(initialLocationStocks.map((stock) => stock.productId));
  const stockByLocations: StockByLocationData[] = [
    ...initialLocationStocks,
    ...products
      .filter((product) => product.currentStock !== "0.000" && !productsWithLocationStock.has(product.id))
      .map((product) => ({
        productId: product.id,
        locationId: locMostradorId,
        quantity: product.currentStock,
      })),
  ];

  const customers: CustomerData[] = [
    {
      id: "cust-001",
      name: "Comedor Doña Carmen",
      documentId: "001-0849201-3",
      phone: "809-555-1234",
      address: "Av. Principal #45, Santo Domingo",
      creditLimit: "25000.00",
      balance: "4250.00",
      status: "ACTIVE",
      createdAt: new Date(),
    },
    {
      id: "cust-002",
      name: "Restaurante El Asador Criollo",
      documentId: "131-09823-1",
      phone: "809-555-8899",
      address: "Calle Los Prados #12",
      creditLimit: "40000.00",
      balance: "12500.00",
      status: "ACTIVE",
      createdAt: new Date(),
    },
    {
      id: "cust-003",
      name: "Juan Pérez (Cliente Contado/Crédito Personal)",
      documentId: "001-1928374-2",
      phone: "829-555-7722",
      address: "Ensanche Quisqueya",
      creditLimit: "5000.00",
      balance: "0.00",
      status: "ACTIVE",
      createdAt: new Date(),
    },
  ];

  const customerLedger: CustomerLedgerData[] = [
    {
      id: "cleg-001",
      customerId: "cust-001",
      type: "VENTA",
      amount: "4250.00",
      referenceId: "sale-old-1",
      note: "Venta a crédito #147",
      userId: "user-cajero-1",
      createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000),
    },
    {
      id: "cleg-002",
      customerId: "cust-002",
      type: "VENTA",
      amount: "15000.00",
      referenceId: "sale-old-2",
      note: "Venta a crédito #149",
      userId: "user-cajero-1",
      createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000),
    },
    {
      id: "cleg-003",
      customerId: "cust-002",
      type: "ABONO",
      amount: "-2500.00",
      referenceId: "abono-old-1",
      note: "Abono a cuenta corriente",
      userId: "user-cajero-1",
      createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
    },
  ];

  const cashSessions: CashSessionData[] = [
    {
      id: "cash-sess-001",
      sessionNumber: 1,
      userId: "user-cajero-1",
      userName: "Claudette Colbert (Cajera Principal)",
      openingAmount: "5000.00",
      expectedAmount: "5000.00",
      status: "OPEN",
      openedAt: new Date(),
    },
  ];

  return {
    categories,
    products,
    locations,
    stockByLocations,
    inventoryMovements: [] as InventoryMovementData[],
    customers,
    customerLedger,
    cashSessions,
    cashMovements: [] as CashMovementData[],
    sales: [] as SaleData[],
    saleLines: [] as SaleLineData[],
    auditLogs: [] as AuditLogData[],
    counters: {
      SALES: 154,
      CASH_SESSIONS: 1,
      RECEIPTS: 10,
    } as Record<string, number>,
  };
}

class InMemDataStore {
  private data = createInitialState();

  // Reset a estado inicial (útil para tests limpios)
  reset() {
    this.data = createInitialState();
  }

  // Categories
  getCategories() {
    return [...this.data.categories];
  }

  // Products
  getProducts() {
    return [...this.data.products];
  }

  getProductById(id: string) {
    return this.data.products.find((p) => p.id === id);
  }

  getProductByCode(code: string) {
    return this.data.products.find((p) => p.code.toLowerCase() === code.toLowerCase());
  }

  addProduct(prod: Omit<ProductData, "id" | "createdAt" | "updatedAt">): ProductData {
    const newProd: ProductData = {
      ...prod,
      id: `prod-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.data.products.unshift(newProd);
    return newProd;
  }

  updateProduct(id: string, updates: Partial<ProductData>): ProductData | undefined {
    const prod = this.getProductById(id);
    if (prod) {
      Object.assign(prod, updates, { updatedAt: new Date() });
    }
    return prod;
  }

  updateProductStock(productId: string, newTotalStock: string) {
    const prod = this.getProductById(productId);
    if (prod) {
      prod.currentStock = newTotalStock;
      prod.updatedAt = new Date();
    }
  }


  // Locations
  getLocations() {
    return [...this.data.locations];
  }

  getLocationById(id: string) {
    return this.data.locations.find((location) => location.id === id);
  }

  addLocation(name: string): LocationData {
    const location: LocationData = {
      id: `loc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name,
      status: "ACTIVE",
      createdAt: new Date(),
    };
    this.data.locations.push(location);
    return location;
  }

  updateLocation(id: string, updates: Partial<Pick<LocationData, "name" | "status">>) {
    const location = this.getLocationById(id);
    if (location) Object.assign(location, updates);
    return location;
  }

  getStockByLocation(productId: string, locationId: string) {
    return this.data.stockByLocations.find(
      (s) => s.productId === productId && s.locationId === locationId
    );
  }

  getStockByLocations() {
    return [...this.data.stockByLocations];
  }

  setStockByLocation(productId: string, locationId: string, quantity: string) {
    const found = this.getStockByLocation(productId, locationId);
    if (found) {
      found.quantity = quantity;
    } else {
      this.data.stockByLocations.push({ productId, locationId, quantity });
    }
  }

  // Inventory Movements
  recordInventoryMovement(movement: Omit<InventoryMovementData, "id" | "createdAt">): InventoryMovementData {
    const entry: InventoryMovementData = {
      ...movement,
      id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date(),
    };
    this.data.inventoryMovements.push(entry);
    return entry;
  }

  getInventoryMovements(productId?: string) {
    if (productId) {
      return this.data.inventoryMovements.filter((m) => m.productId === productId);
    }
    return [...this.data.inventoryMovements];
  }

  // Customers
  getCustomers() {
    return [...this.data.customers];
  }

  getCustomerById(id: string) {
    return this.data.customers.find((c) => c.id === id);
  }

  addCustomer(customer: Omit<CustomerData, "id" | "createdAt" | "balance">): CustomerData {
    const newCustomer: CustomerData = {
      ...customer,
      id: `cust-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      balance: "0.00",
      createdAt: new Date(),
    };
    this.data.customers.unshift(newCustomer);
    return newCustomer;
  }

  updateCustomer(id: string, updates: Partial<CustomerData>): CustomerData | undefined {
    const customer = this.getCustomerById(id);
    if (customer) {
      Object.assign(customer, updates, { id: customer.id, balance: customer.balance, createdAt: customer.createdAt });
    }
    return customer;
  }

  updateCustomerBalance(customerId: string, newBalance: string) {
    const cust = this.getCustomerById(customerId);
    if (cust) {
      cust.balance = newBalance;
    }
  }

  // Customer Ledger
  recordCustomerLedgerEntry(entry: Omit<CustomerLedgerData, "id" | "createdAt">): CustomerLedgerData {
    const record: CustomerLedgerData = {
      ...entry,
      id: `cleg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date(),
    };
    this.data.customerLedger.push(record);
    return record;
  }

  getCustomerLedger(customerId: string) {
    return this.data.customerLedger.filter((l) => l.customerId === customerId);
  }

  // Cash Sessions
  getActiveCashSession(): CashSessionData | undefined {
    return this.data.cashSessions.find((s) => s.status === "OPEN");
  }

  getCashSessions() {
    return [...this.data.cashSessions];
  }

  createCashSession(session: Omit<CashSessionData, "id" | "sessionNumber" | "openedAt">): CashSessionData {
    this.data.counters.CASH_SESSIONS = (this.data.counters.CASH_SESSIONS || 0) + 1;
    const newSession: CashSessionData = {
      ...session,
      id: `cash-sess-${Date.now()}`,
      sessionNumber: this.data.counters.CASH_SESSIONS,
      openedAt: new Date(),
    };
    this.data.cashSessions.push(newSession);
    return newSession;
  }

  updateCashSession(id: string, updates: Partial<CashSessionData>): CashSessionData | undefined {
    const session = this.data.cashSessions.find((s) => s.id === id);
    if (session) {
      Object.assign(session, updates);
    }
    return session;
  }

  recordCashMovement(mov: Omit<CashMovementData, "id" | "createdAt">): CashMovementData {
    const entry: CashMovementData = {
      ...mov,
      id: `cmov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date(),
    };
    this.data.cashMovements.push(entry);
    return entry;
  }

  getCashMovements(sessionId: string) {
    return this.data.cashMovements.filter((m) => m.cashSessionId === sessionId);
  }

  // Sales
  getNextSaleNumber(): number {
    this.data.counters.SALES = (this.data.counters.SALES || 150) + 1;
    return this.data.counters.SALES;
  }

  getSales() {
    return [...this.data.sales];
  }

  getSaleById(id: string) {
    return this.data.sales.find((s) => s.id === id);
  }

  getSaleByClientOpId(clientOpId: string) {
    return this.data.sales.find((s) => s.clientOpId === clientOpId);
  }

  createSale(sale: SaleData): SaleData {
    this.data.sales.unshift(sale);
    for (const line of sale.lines) {
      this.data.saleLines.push(line);
    }
    return sale;
  }

  updateSale(id: string, updates: Partial<SaleData>) {
    const sale = this.getSaleById(id);
    if (sale) {
      Object.assign(sale, updates);
    }
    return sale;
  }

  // Audit Logs
  recordAuditLog(log: Omit<AuditLogData, "id" | "createdAt">): AuditLogData {
    const entry: AuditLogData = {
      ...log,
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date(),
    };
    this.data.auditLogs.unshift(entry);
    return entry;
  }

  getAuditLogs() {
    return [...this.data.auditLogs];
  }
}

// Exportamos instancia singleton del DataStore
export const store = new InMemDataStore();
