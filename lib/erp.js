import { dateNow, documentNo, id } from "./schema.js";

export const money = (value, currency = "PKR") => new Intl.NumberFormat("en-PK", {
  style: "currency", currency, maximumFractionDigits: 2,
}).format(Number(value || 0));

export const stockFor = (state, itemId, rackId = null) => state.stockMovements
  .filter((m) => m.itemId === itemId && (!rackId || m.rackId === rackId))
  .reduce((sum, m) => sum + Number(m.quantity), 0);

export const accountBalance = (state, accountId) => {
  const account = state.accounts.find((a) => a.id === accountId);
  if (!account) return 0;
  return Number(account.openingBalance || 0) + state.journal.reduce((sum, entry) => sum + entry.lines
    .filter((line) => line.accountId === accountId)
    .reduce((lineSum, line) => lineSum + Number(line.debit || 0) - Number(line.credit || 0), 0), 0);
};

export const partyBalance = (state, partyId) => {
  const party = state.parties.find((p) => p.id === partyId);
  if (!party) return 0;
  const rows = state.partyLedger.filter((row) => row.partyId === partyId);
  const movement = rows.reduce((sum, row) => sum + Number(row.debit || 0) - Number(row.credit || 0), 0);
  return party.type === "Supplier" ? -movement : movement;
};

const audit = (state, action, detail = "") => { const actor = state.__actor || {}; state.audit.unshift({
  id: id("AUD"), at: new Date().toISOString(), userId: actor.id || "system", user: actor.name || "System", username: actor.username || "system", role: actor.role || "System", action, detail,
}); };
export const recordAudit = (state, action, detail = "") => audit(state, action, detail);

const postJournal = (state, document, description, lines, partyId = null, date = dateNow()) => {
  const debit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const credit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  if (Math.abs(debit - credit) > 0.01) throw new Error(`Journal is not balanced for ${document}.`);
  state.journal.unshift({ id: id("JRN"), date, document, description, partyId, lines });
};

const addStock = (state, { itemId, rackId, quantity, rate, type, document, date = dateNow(), note = "" }) => {
  state.stockMovements.unshift({ id: id("MOV"), date, itemId, rackId, quantity: Number(quantity), rate: Number(rate || 0), type, document, note });
};

export function nextItemSku(state, type = "Finished Good") {
  const prefix = { "Raw Material": "RM", "Finished Good": "FG", Consumable: "CON", Other: "ITM" }[type] || "ITM";
  const pattern = new RegExp(`^${prefix}-(\\d+)$`, "i");
  const highest = state.items.reduce((max, item) => {
    const match = String(item.sku || "").match(pattern);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}-${String(highest + 1).padStart(4, "0")}`;
}

export function addItem(state, values) {
  const sku = String(values.sku || "").trim() || nextItemSku(state, values.type);
  if (state.items.some(item => String(item.sku || "").trim().toLowerCase() === sku.toLowerCase())) throw new Error("This SKU / item code already exists. Reopen the form to generate the next code.");
  const itemId = id("ITM");
  state.items.push({ id: itemId, ...values, sku, cost: Number(values.cost || 0), saleRate: Number(values.saleRate || 0), minStock: Number(values.minStock || 0) });
  if (Number(values.openingQty || 0)) {
    addStock(state, { itemId, rackId: values.rackId || "", quantity: Number(values.openingQty), rate: values.cost, type: "Opening stock", document: "OPENING" });
  }
  audit(state, `Created ${values.type.toLowerCase()} ${values.name}`);
  return itemId;
}

export function addParty(state, values) {
  if (state.parties.some(party => party.name.trim().toLowerCase() === values.name.trim().toLowerCase())) throw new Error("A party with this name already exists.");
  const partyId = id("PTY");
  state.parties.push({ id: partyId, ...values, creditLimit: Number(values.creditLimit || 0) });
  const opening = Number(values.openingBalance || 0);
  if (opening) state.partyLedger.push({ id: id("PLD"), date: values.openingDate || dateNow(), partyId, document: "OPENING", description: "Opening balance", debit: values.type === "Supplier" ? 0 : opening, credit: values.type === "Supplier" ? opening : 0 });
  audit(state, `Created ${values.type.toLowerCase()} ${values.name}`);
  return partyId;
}

export function addRack(state, values) {
  if (state.racks.some(rack => rack.code.trim().toLowerCase() === values.code.trim().toLowerCase())) throw new Error("This rack code already exists.");
  state.racks.push({ id: id("RACK"), ...values, capacity: Number(values.capacity || 0) });
  audit(state, `Created rack ${values.code}`);
}

export function addAccount(state, values) {
  if (state.accounts.some(account => account.name.trim().toLowerCase() === values.name.trim().toLowerCase())) throw new Error("An account with this name already exists.");
  state.accounts.push({ id: id("ACC"), ...values, openingBalance: Number(values.openingBalance || 0) });
  audit(state, `Created ${values.type.toLowerCase()} account ${values.name}`);
}

export function addBOM(state, values) {
  if (state.boms.some(bom => bom.productId === values.productId && bom.version === (values.version || "1.0"))) throw new Error("This product already has a BOM with the same version.");
  const bomId = id("BOM");
  state.boms.push({ id: bomId, ...values, outputQty: Number(values.outputQty), lines: values.lines.map(l => ({ ...l, quantity: Number(l.quantity) })), costs: values.costs.map(c => ({ ...c, amount: Number(c.amount) })), active: true, version: values.version || "1.0" });
  audit(state, `Created BOM ${values.name}`);
  return bomId;
}

export function adjustStock(state, values) {
  const current = stockFor(state, values.itemId, values.rackId);
  const qty = Number(values.quantity) * (values.direction === "Decrease" ? -1 : 1);
  if (!state.settings.negativeStock && current + qty < 0) throw new Error("This adjustment would create negative stock in the selected rack.");
  const reference = id("ADJ");
  const item = state.items.find(i => i.id === values.itemId);
  addStock(state, { itemId: values.itemId, rackId: values.rackId, quantity: qty, rate: item?.cost || 0, type: "Stock adjustment", document: reference, note: values.reason });
  audit(state, `Posted stock adjustment ${reference}`, values.reason);
}

export function transferStock(state, values) {
  const qty = Number(values.quantity);
  if (values.fromRackId === values.toRackId) throw new Error("Source and destination racks must be different.");
  if (!state.settings.negativeStock && stockFor(state, values.itemId, values.fromRackId) < qty) throw new Error("Insufficient stock in the source rack.");
  const reference = id("TRF");
  const item = state.items.find(i => i.id === values.itemId);
  addStock(state, { itemId: values.itemId, rackId: values.fromRackId, quantity: -qty, rate: item?.cost || 0, type: "Rack transfer out", document: reference });
  addStock(state, { itemId: values.itemId, rackId: values.toRackId, quantity: qty, rate: item?.cost || 0, type: "Rack transfer in", document: reference });
  audit(state, `Transferred stock ${reference}`);
}

export function postPurchase(state, values) {
  const supplier = state.parties.find(p => p.id === values.partyId && ["Supplier", "Both"].includes(p.type));
  if (!supplier) throw new Error("Select a valid supplier.");
  const document = documentNo(state.settings.purchasePrefix, state.purchases);
  if (state.purchases.some(p => p.partyId === values.partyId && p.supplierInvoice.trim().toLowerCase() === values.supplierInvoice.trim().toLowerCase())) throw new Error("This supplier invoice number has already been posted for the selected vendor.");
  const total = values.lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.rate), 0) + Number(values.charges || 0) - Number(values.discount || 0);
  const paid = Number(values.paid || 0);
  if (paid > total) throw new Error("Paid amount cannot exceed purchase total.");
  if (paid > 0 && !state.accounts.some(a => a.id === values.accountId)) throw new Error("Select the cash or bank account used for the payment.");
  values.lines.forEach(line => {
    const item = state.items.find(i => i.id === line.itemId);
    const previousQty = stockFor(state, line.itemId);
    const oldValue = previousQty * Number(item.cost || 0);
    const lineQty = Number(line.quantity);
    const lineValue = lineQty * Number(line.rate);
    item.cost = previousQty + lineQty > 0 ? (oldValue + lineValue) / (previousQty + lineQty) : Number(line.rate);
    addStock(state, { itemId: line.itemId, rackId: line.rackId, quantity: lineQty, rate: line.rate, type: "Purchase receipt", document, date: values.date });
  });
  state.purchases.unshift({ id: id("PUR"), document, ...values, total, paid, status: paid >= total ? "Paid" : paid > 0 ? "Partially Paid" : "Unpaid", posted: true });
  state.partyLedger.unshift({ id: id("PLD"), date: values.date, partyId: values.partyId, document, description: "Purchase invoice", debit: 0, credit: total });
  if (paid) state.partyLedger.unshift({ id: id("PLD"), date: values.date, partyId: values.partyId, document, description: "Payment with purchase", debit: paid, credit: 0 });
  const journalLines = [{ accountName: "Inventory", debit: total, credit: 0 }];
  if (paid) journalLines.push({ accountId: values.accountId, accountName: state.accounts.find(a => a.id === values.accountId)?.name || "Cash/Bank", debit: 0, credit: paid });
  if (total - paid) journalLines.push({ accountName: "Accounts Payable", debit: 0, credit: total - paid });
  postJournal(state, document, "Purchase invoice", journalLines, values.partyId, values.date);
  audit(state, `Posted purchase ${document}`);
  return document;
}

function saveSale(state, values, preserved = {}) {
  const customer = state.parties.find(p => p.id === values.partyId && ["Customer", "Both"].includes(p.type));
  if (!customer) throw new Error("Select a valid customer.");
  for (const line of values.lines) if (!state.settings.negativeStock && stockFor(state, line.itemId, line.rackId) < Number(line.quantity)) throw new Error(`${state.items.find(i => i.id === line.itemId)?.name} has insufficient stock in the selected rack.`);
  const document = preserved.document || documentNo(state.settings.invoicePrefix, state.sales);
  const subtotal = values.lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.rate), 0);
  const total = subtotal + Number(values.tax || 0) + Number(values.charges || 0) - Number(values.discount || 0);
  const paid = Number(values.paid || 0);
  if (paid > total) throw new Error("Received amount cannot exceed invoice total.");
  if (paid > 0 && !state.accounts.some(a => a.id === values.accountId)) throw new Error("Select the cash or bank account used for the receipt.");
  let cogs = 0;
  values.lines.forEach(line => {
    const item = state.items.find(i => i.id === line.itemId);
    cogs += Number(line.quantity) * Number(item.cost || 0);
    addStock(state, { itemId: line.itemId, rackId: line.rackId, quantity: -Number(line.quantity), rate: item.cost, type: "Sales issue", document, date: values.date });
  });
  state.sales.unshift({ id: preserved.id || id("SAL"), document, ...values, lines: values.lines.map(line => ({ ...line, quantity: Number(line.quantity), rate: Number(line.rate) })), subtotal, total, paid, cogs, status: paid >= total ? "Paid" : paid > 0 ? "Partially Paid" : "Unpaid", posted: true, updatedAt: preserved.id ? new Date().toISOString() : undefined });
  state.partyLedger.unshift({ id: id("PLD"), date: values.date, partyId: values.partyId, document, description: "Sales invoice", debit: total, credit: 0 });
  if (paid) state.partyLedger.unshift({ id: id("PLD"), date: values.date, partyId: values.partyId, document, description: "Receipt with invoice", debit: 0, credit: paid });
  const lines = [{ accountName: "Sales", debit: 0, credit: total }, { accountName: "Cost of Goods Sold", debit: cogs, credit: 0 }, { accountName: "Finished Goods Inventory", debit: 0, credit: cogs }];
  if (paid) lines.push({ accountId: values.accountId, accountName: state.accounts.find(a => a.id === values.accountId)?.name || "Cash/Bank", debit: paid, credit: 0 });
  if (total - paid) lines.push({ accountName: "Accounts Receivable", debit: total - paid, credit: 0 });
  postJournal(state, document, "Sales invoice", lines, values.partyId, values.date);
  audit(state, `${preserved.id ? "Updated" : "Posted"} sales invoice ${document}`);
  return document;
}

export function postSale(state, values) { return saveSale(state, values); }

export function updateSale(state, saleId, values) {
  const existing = state.sales.find(s => s.id === saleId);
  if (!existing) throw new Error("Invoice no longer exists.");
  state.sales = state.sales.filter(s => s.id !== saleId);
  state.stockMovements = state.stockMovements.filter(m => m.document !== existing.document);
  state.partyLedger = state.partyLedger.filter(r => r.document !== existing.document);
  state.journal = state.journal.filter(j => j.document !== existing.document);
  return saveSale(state, values, { id: existing.id, document: existing.document });
}

export function deleteSale(state, saleId) {
  const existing = state.sales.find(s => s.id === saleId);
  if (!existing) throw new Error("Invoice no longer exists.");
  const customer = state.parties.find(p => p.id === existing.partyId);
  state.sales = state.sales.filter(s => s.id !== saleId);
  state.stockMovements = state.stockMovements.filter(m => m.document !== existing.document);
  state.partyLedger = state.partyLedger.filter(r => r.document !== existing.document);
  state.journal = state.journal.filter(j => j.document !== existing.document);
  audit(state, `Deleted sales invoice ${existing.document}`, `${customer?.name || "Unknown customer"} · ${money(existing.total)}`);
  return existing.document;
}

export function addPendingOrder(state, values) {
  const customer = state.parties.find(p => p.id === values.partyId && ["Customer", "Both"].includes(p.type));
  if (!customer) throw new Error("Select a valid customer.");
  if (!values.lines?.length || values.lines.some(l => !l.itemId || Number(l.quantity) <= 0 || Number(l.rate) < 0)) throw new Error("Every pending-order line needs an item, quantity and valid price.");
  const order = { id: id("ORD"), document: documentNo("ORD", state.pendingOrders), partyId: values.partyId, pendingDate: values.pendingDate || dateNow(), requiredDate: values.requiredDate || "", notes: values.notes || "", lines: values.lines.map(l => ({ itemId: l.itemId, quantity: Number(l.quantity), rate: Number(l.rate) })), status: "Pending", createdAt: new Date().toISOString() };
  state.pendingOrders.unshift(order); audit(state, `Created pending order ${order.document}`); return order.document;
}

export function updatePendingOrderStatus(state, orderId, status) {
  const order = state.pendingOrders.find(o => o.id === orderId); if (!order) throw new Error("Pending order no longer exists.");
  order.status = status; order.updatedAt = new Date().toISOString(); audit(state, `Marked ${order.document} ${status.toLowerCase()}`);
}

export function postProduction(state, values) {
  const bom = state.boms.find(b => b.id === values.bomId);
  if (!bom) throw new Error("Select a valid BOM.");
  const multiplier = Number(values.quantity) / Number(bom.outputQty);
  for (const line of bom.lines) {
    const required = Number(line.quantity) * multiplier;
    const rackId = values.issueRacks[line.itemId] || line.rackId;
    if (!state.settings.negativeStock && stockFor(state, line.itemId, rackId || null) < required) throw new Error(`Insufficient ${state.items.find(i => i.id === line.itemId)?.name}${rackId ? " in the selected rack" : ""}.`);
  }
  const document = documentNo(state.settings.productionPrefix, state.productions);
  let materialCost = 0;
  bom.lines.forEach(line => {
    const item = state.items.find(i => i.id === line.itemId);
    const required = Number(line.quantity) * multiplier;
    materialCost += required * Number(item.cost || 0);
    addStock(state, { itemId: line.itemId, rackId: values.issueRacks[line.itemId] || line.rackId, quantity: -required, rate: item.cost, type: "Production consumption", document, date: values.date });
  });
  const extraCosts = bom.costs.map(c => ({ ...c, calculated: Number(c.amount) * multiplier }));
  const conversionCost = extraCosts.reduce((s, c) => s + c.calculated, 0) + Number(values.additionalCost || 0);
  const totalCost = materialCost + conversionCost;
  const product = state.items.find(i => i.id === bom.productId);
  const oldQty = stockFor(state, product.id);
  product.cost = oldQty + Number(values.quantity) > 0 ? (oldQty * Number(product.cost || 0) + totalCost) / (oldQty + Number(values.quantity)) : totalCost / Number(values.quantity);
  addStock(state, { itemId: product.id, rackId: values.outputRackId, quantity: Number(values.quantity), rate: totalCost / Number(values.quantity), type: "Production output", document, date: values.date });
  state.productions.unshift({ id: id("PRD"), document, ...values, bomSnapshot: structuredClone(bom), materialCost, extraCosts, conversionCost, totalCost, unitCost: totalCost / Number(values.quantity), status: "Posted" });
  postJournal(state, document, "Production posting", [{ accountName: "Finished Goods Inventory", debit: totalCost, credit: 0 }, { accountName: "Raw Material Inventory", debit: 0, credit: materialCost }, { accountName: "Production Cost Applied", debit: 0, credit: conversionCost }], null, values.date);
  audit(state, `Posted production ${document}`);
  return document;
}

export function postPayment(state, values) {
  const party = state.parties.find(p => p.id === values.partyId);
  const account = state.accounts.find(a => a.id === values.accountId);
  if (!party || !account) throw new Error("Select a party and cash/bank account.");
  const amount = Number(values.amount);
  const isReceipt = values.direction === "Receipt";
  const document = id(isReceipt ? "REC" : "PAY");
  state.payments.unshift({ id: id("PMT"), document, ...values, amount, posted: true });
  state.partyLedger.unshift({ id: id("PLD"), date: values.date, partyId: values.partyId, document, description: values.description || `${values.direction} via ${account.name}`, debit: isReceipt ? 0 : amount, credit: isReceipt ? amount : 0 });
  postJournal(state, document, `${values.direction} - ${party.name}`, isReceipt ? [{ accountId: account.id, accountName: account.name, debit: amount, credit: 0 }, { accountName: "Accounts Receivable", debit: 0, credit: amount }] : [{ accountName: "Accounts Payable", debit: amount, credit: 0 }, { accountId: account.id, accountName: account.name, debit: 0, credit: amount }], party.id, values.date);
  audit(state, `Posted ${values.direction.toLowerCase()} ${document}`);
}

export function postExpense(state, values) {
  const account = state.accounts.find(a => a.id === values.accountId);
  if (!account) throw new Error("Select a cash/bank account.");
  const document = id("EXP");
  const amount = Number(values.amount);
  state.expenses.unshift({ id: id("EXR"), document, ...values, amount, status: "Posted" });
  postJournal(state, document, values.description, [{ accountName: `Expense - ${values.category}`, debit: amount, credit: 0 }, { accountId: account.id, accountName: account.name, debit: 0, credit: amount }], null, values.date);
  audit(state, `Posted expense ${document}`);
}
