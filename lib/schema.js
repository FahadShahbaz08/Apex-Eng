export const SCHEMA_VERSION = 7;

export const createEmptyERP = () => ({
  meta: { schemaVersion: SCHEMA_VERSION, createdAt: new Date().toISOString() },
  company: {
    name: "Apex Engineering",
    address: "",
    phone: "",
    email: "",
    taxNumber: "",
    currency: "PKR",
  },
  settings: {
    negativeStock: false,
    costingMethod: "Weighted Average",
    financialYearStart: "",
    invoicePrefix: "INV",
    purchasePrefix: "PUR",
    productionPrefix: "PROD",
    roles: {
      Administrator: ["all"],
      Accountant: ["accounts", "sales", "purchases", "expenses", "reports", "ledgers", "parties"],
      Storekeeper: ["items", "stock", "racks", "purchases", "parties"],
      Production: ["bom", "production", "stock"],
      Sales: ["sales", "parties", "ledgers"],
      Viewer: ["view"],
    },
  },
  items: [],
  racks: [],
  parties: [],
  boms: [],
  accounts: [],
  users: [],
  purchases: [],
  sales: [],
  pendingOrders: [],
  productions: [],
  expenses: [],
  payments: [],
  bankTransfers: [],
  stockMovements: [],
  partyLedger: [],
  journal: [],
  audit: [],
});

export const id = (prefix) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
export const dateNow = () => new Date().toISOString().slice(0, 10);
export const documentNo = (prefix, collection) => `${prefix}-${String(collection.length + 1).padStart(5, "0")}`;

export function migrateERP(input) {
  const empty = createEmptyERP();
  if (!input || typeof input !== "object") return empty;
  return {
    ...empty,
    ...input,
    meta: { ...empty.meta, ...(input.meta || {}), schemaVersion: SCHEMA_VERSION },
    company: { ...empty.company, ...(input.company || {}), name: input.company?.name || "Apex Engineering" },
    settings: { ...empty.settings, ...(input.settings || {}), roles: { ...empty.settings.roles, ...(input.settings?.roles || {}) } },
  };
}
