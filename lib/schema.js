export const SCHEMA_VERSION = 11;

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
    documentSequences: {
      invoice: 0,
      purchase: 0,
      servicePurchase: 0,
      pendingOrder: 0,
      production: 0,
    },
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
  servicePurchases: [],
  sales: [],
  pendingOrders: [],
  productions: [],
  expenseCategories: [],
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

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const highestIssuedNumber = (prefix, collection = [], audit = []) => {
  const pattern = new RegExp(`${escapeRegExp(prefix)}-(\\d+)`, "gi");
  const values = [
    ...collection.flatMap(row => typeof row === "string" ? [row] : [row?.document]),
    ...audit.flatMap(row => typeof row === "string" ? [row] : [row?.action, row?.detail]),
  ];
  return values.reduce((highest, value) => {
    const matches = String(value || "").matchAll(pattern);
    for (const match of matches) highest = Math.max(highest, Number(match[1]) || 0);
    return highest;
  }, 0);
};

// Kept for compatibility with older callers, but uses the highest document
// number instead of collection length so gaps never create duplicates.
export const documentNo = (prefix, collection = []) => `${prefix}-${String(highestIssuedNumber(prefix, collection) + 1).padStart(5, "0")}`;

// Persistent sequences ensure even the newest deleted document number is never
// issued again. Audit history also protects data created before schema v11.
export const nextDocumentNo = (state, sequenceKey, prefix, collection = []) => {
  state.settings ||= {};
  state.settings.documentSequences ||= {};
  const remembered = Number(state.settings.documentSequences[sequenceKey]) || 0;
  const highest = highestIssuedNumber(prefix, collection, state.audit || []);
  const next = Math.max(remembered, highest) + 1;
  state.settings.documentSequences[sequenceKey] = next;
  return `${prefix}-${String(next).padStart(5, "0")}`;
};

export function migrateERP(input) {
  const empty = createEmptyERP();
  if (!input || typeof input !== "object") return empty;
  return {
    ...empty,
    ...input,
    meta: { ...empty.meta, ...(input.meta || {}), schemaVersion: SCHEMA_VERSION },
    company: { ...empty.company, ...(input.company || {}), name: input.company?.name || "Apex Engineering" },
    settings: {
      ...empty.settings,
      ...(input.settings || {}),
      roles: { ...empty.settings.roles, ...(input.settings?.roles || {}) },
      documentSequences: { ...empty.settings.documentSequences, ...(input.settings?.documentSequences || {}) },
    },
  };
}
