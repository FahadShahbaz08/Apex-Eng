import { dateNow, documentNo, id } from "./schema.js";

export const money = (value, currency = "PKR") => new Intl.NumberFormat("en-PK", {
  style: "currency", currency, maximumFractionDigits: 2,
}).format(Number(value || 0));

export const stockFor = (state, itemId, rackId = null) => state.stockMovements
  .filter((m) => m.itemId === itemId && (!rackId || m.rackId === rackId))
  .reduce((sum, m) => sum + Number(m.quantity), 0);

export const accountBalance = (state, accountId, asOfDate = dateNow()) => {
  const account = state.accounts.find((a) => a.id === accountId);
  if (!account) return 0;
  return Number(account.openingBalance || 0) + state.journal
    .filter((entry) => !entry.date || entry.date <= asOfDate)
    .reduce((sum, entry) => sum + entry.lines
    .filter((line) => line.accountId === accountId)
    .filter((line) => {
      const payment = state.payments.find((row) => row.document === entry.document);
      return !(payment?.direction === "Payment" && payment.paymentMethod === "Cheque" && payment.chequeDate > asOfDate);
    })
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

export function updateItem(state, itemId, values) {
  const item = state.items.find(row => row.id === itemId);
  if (!item) throw new Error("Item no longer exists.");
  const duplicate = state.items.some(row => row.id !== itemId && String(row.sku || "").trim().toLowerCase() === String(values.sku || item.sku).trim().toLowerCase());
  if (duplicate) throw new Error("This SKU / item code already exists.");
  const nextType = values.type || item.type;
  const isUsedAsMaterial = state.boms.some(bom => bom.lines.some(line => line.itemId === itemId));
  const isFinishedProduct = state.boms.some(bom => bom.productId === itemId);
  if (isUsedAsMaterial && !["Raw Material", "Consumable"].includes(nextType)) throw new Error("This item is used as a BOM material and must remain Raw Material or Consumable.");
  if (isFinishedProduct && nextType !== "Finished Good") throw new Error("This item is the output of a BOM and must remain a Finished Good.");
  Object.assign(item, values, { id: item.id, sku: String(values.sku || item.sku).trim(), type: nextType, cost: Number(values.cost || 0), saleRate: Number(values.saleRate || 0), minStock: Number(values.minStock || 0) });
  delete item.openingQty; delete item.rackId;
  audit(state, `Updated ${item.type.toLowerCase()} ${item.name}`, item.sku);
  return item.id;
}

export function deleteItem(state, itemId) {
  const item = state.items.find(row => row.id === itemId);
  if (!item) throw new Error("Item no longer exists.");
  const used = state.boms.some(bom => bom.productId === itemId || bom.lines.some(line => line.itemId === itemId)) ||
    state.purchases.some(document => document.lines?.some(line => line.itemId === itemId)) ||
    state.sales.some(document => document.lines?.some(line => line.itemId === itemId)) ||
    state.pendingOrders.some(document => document.lines?.some(line => line.itemId === itemId)) ||
    state.productions.some(document => document.bomSnapshot?.productId === itemId || document.bomSnapshot?.lines?.some(line => line.itemId === itemId));
  if (used) throw new Error("This item has BOM or transaction history. Remove those linked records first; historical stock references cannot be orphaned.");
  state.items = state.items.filter(row => row.id !== itemId);
  state.stockMovements = state.stockMovements.filter(row => row.itemId !== itemId);
  audit(state, `Deleted ${item.type.toLowerCase()} ${item.name}`, item.sku);
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

export function updateParty(state, partyId, values) {
  const party = state.parties.find(row => row.id === partyId);
  if (!party) throw new Error("Customer or supplier no longer exists.");
  if (state.parties.some(row => row.id !== partyId && row.name.trim().toLowerCase() === values.name.trim().toLowerCase())) throw new Error("A party with this name already exists.");
  const nextType = values.type || party.type;
  if (state.sales.some(row => row.partyId === partyId) && !["Customer", "Both"].includes(nextType)) throw new Error("This party has sales history and must remain a Customer or Both.");
  if (state.purchases.some(row => row.partyId === partyId) && !["Supplier", "Both"].includes(nextType)) throw new Error("This party has purchase history and must remain a Supplier or Both.");
  Object.assign(party, values, { id: party.id, type: nextType, creditLimit: Number(values.creditLimit || 0), paymentTerms: Number(values.paymentTerms || 0), openingBalance: Number(values.openingBalance || 0) });
  state.partyLedger = state.partyLedger.filter(row => !(row.partyId === partyId && row.document === "OPENING"));
  const opening = Number(values.openingBalance || 0);
  if (opening) state.partyLedger.push({ id: id("PLD"), date: values.openingDate || dateNow(), partyId, document: "OPENING", description: "Opening balance", debit: nextType === "Supplier" ? 0 : opening, credit: nextType === "Supplier" ? opening : 0 });
  audit(state, `Updated ${nextType.toLowerCase()} ${party.name}`);
  return party.id;
}

export function deleteParty(state, partyId) {
  const party = state.parties.find(row => row.id === partyId);
  if (!party) throw new Error("Customer or supplier no longer exists.");
  const used = state.sales.some(row => row.partyId === partyId) || state.purchases.some(row => row.partyId === partyId) || state.payments.some(row => row.partyId === partyId) || state.pendingOrders.some(row => row.partyId === partyId) || state.partyLedger.some(row => row.partyId === partyId && row.document !== "OPENING") || state.journal.some(row => row.partyId === partyId);
  if (used) throw new Error("This customer or supplier has transaction history and cannot be deleted. Keep the account for audit integrity.");
  state.parties = state.parties.filter(row => row.id !== partyId);
  state.partyLedger = state.partyLedger.filter(row => row.partyId !== partyId);
  audit(state, `Deleted ${party.type.toLowerCase()} ${party.name}`);
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

export function updateBOM(state, bomId, values) {
  const bom = state.boms.find(row => row.id === bomId);
  if (!bom) throw new Error("BOM no longer exists.");
  if (state.boms.some(row => row.id !== bomId && row.productId === values.productId && row.version === (values.version || "1.0"))) throw new Error("This product already has a BOM with the same version.");
  Object.assign(bom, values, { id: bom.id, outputQty: Number(values.outputQty), lines: values.lines.map(line => ({ ...line, quantity: Number(line.quantity) })), costs: values.costs.map(cost => ({ ...cost, amount: Number(cost.amount) })), active: values.active !== false, version: values.version || "1.0", updatedAt: new Date().toISOString() });
  audit(state, `Updated BOM ${bom.name}`, `Version ${bom.version}`);
  return bom.id;
}

export function deleteBOM(state, bomId) {
  const bom = state.boms.find(row => row.id === bomId);
  if (!bom) throw new Error("BOM no longer exists.");
  state.boms = state.boms.filter(row => row.id !== bomId);
  audit(state, `Deleted BOM ${bom.name}`, `Version ${bom.version}; posted production snapshots were preserved`);
}

export function adjustStock(state, values) {
  const current = stockFor(state, values.itemId, values.rackId);
  const qty = Number(values.quantity) * (values.direction === "Decrease" ? -1 : 1);
  if (!state.settings.negativeStock && current + qty < 0) throw new Error("This adjustment would create negative stock in the selected rack.");
  const reference = id("ADJ");
  const item = state.items.find(i => i.id === values.itemId);
  addStock(state, { itemId: values.itemId, rackId: values.rackId, quantity: qty, rate: item?.cost || 0, type: "Stock adjustment", document: reference, note: values.reason, date: values.date || dateNow() });
  audit(state, `Posted stock adjustment ${reference}`, values.reason);
}

export function updateStockAdjustment(state, movementId, values) {
  const movement = state.stockMovements.find(row => row.id === movementId);
  if (!movement || movement.type !== "Stock adjustment") throw new Error("Only manual stock adjustments can be edited.");
  const quantity = Number(values.quantity) * (values.direction === "Decrease" ? -1 : 1);
  const oldRemaining = stockFor(state, movement.itemId) - Number(movement.quantity);
  const targetBefore = movement.itemId === values.itemId ? oldRemaining : stockFor(state, values.itemId);
  if (!state.settings.negativeStock && (oldRemaining < 0 || targetBefore + quantity < 0)) throw new Error("This change would create negative stock.");
  const item = state.items.find(row => row.id === values.itemId);
  Object.assign(movement, { date: values.date || movement.date, itemId: values.itemId, rackId: values.rackId || "", quantity, rate: Number(item?.cost || 0), note: values.reason });
  audit(state, `Updated stock adjustment ${movement.document}`, values.reason);
}

export function deleteStockAdjustment(state, movementId) {
  const movement = state.stockMovements.find(row => row.id === movementId);
  if (!movement || movement.type !== "Stock adjustment") throw new Error("Only manual stock adjustments can be deleted.");
  if (!state.settings.negativeStock && stockFor(state, movement.itemId) - Number(movement.quantity) < 0) throw new Error("Deleting this adjustment would create negative stock because later movements consumed it.");
  state.stockMovements = state.stockMovements.filter(row => row.id !== movementId);
  audit(state, `Deleted stock adjustment ${movement.document}`, movement.note || "Manual adjustment reversal");
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

function savePayment(state, values, existing = null) {
  const party = state.parties.find(p => p.id === values.partyId);
  const account = state.accounts.find(a => a.id === values.accountId);
  if (!party || !account) throw new Error("Select a party and cash/bank account.");
  const amount = Number(values.amount);
  if (!(amount > 0)) throw new Error("Payment amount must be greater than zero.");
  const isReceipt = values.direction === "Receipt";
  const document = existing?.document || id(isReceipt ? "REC" : "PAY");
  const paymentMethod = values.paymentMethod || "Cheque";
  if (paymentMethod === "Cheque" && !values.chequeDate) throw new Error("Enter the cheque date.");
  const deferredVendorCheque = !isReceipt && paymentMethod === "Cheque";
  const chequeStatus = paymentMethod === "Cheque"
    ? (existing?.paymentMethod === "Cheque" ? existing.chequeStatus || (isReceipt ? "In hand" : "Issued") : (isReceipt ? "In hand" : "Issued"))
    : "Not applicable";
  state.payments.unshift({ id: existing?.id || id("PMT"), document, ...values, paymentMethod, amount, chequeStatus, posted: true });
  state.partyLedger.unshift({ id: id("PLD"), date: values.date, partyId: values.partyId, document, description: values.description || `${values.direction} via ${account.name}`, debit: isReceipt ? 0 : amount, credit: isReceipt ? amount : 0 });
  if (isReceipt) {
    postJournal(state, document, `${values.direction} - ${party.name}`, [{ accountId: account.id, accountName: account.name, debit: amount, credit: 0 }, { accountName: "Accounts Receivable", debit: 0, credit: amount }], party.id, values.date);
  } else if (deferredVendorCheque) {
    postJournal(state, document, `Vendor cheque issued - ${party.name}`, [{ accountName: "Accounts Payable", debit: amount, credit: 0 }, { accountName: "Cheques Issued", debit: 0, credit: amount }], party.id, values.date);
    postJournal(state, document, `Vendor cheque due - ${party.name}`, [{ accountName: "Cheques Issued", debit: amount, credit: 0 }, { accountId: account.id, accountName: account.name, debit: 0, credit: amount }], party.id, values.chequeDate);
  } else {
    postJournal(state, document, `${values.direction} - ${party.name}`, [{ accountName: "Accounts Payable", debit: amount, credit: 0 }, { accountId: account.id, accountName: account.name, debit: 0, credit: amount }], party.id, values.date);
  }
  audit(state, `${existing ? "Updated" : "Posted"} ${values.direction.toLowerCase()} ${document}`, `${party.name} · ${money(amount)} · ${paymentMethod}${values.chequeDate ? ` · cheque date ${values.chequeDate}` : ""}`);
  return document;
}

export function postPayment(state, values) {
  return savePayment(state, values);
}

export function updatePayment(state, paymentId, values) {
  const payment = state.payments.find(row => row.id === paymentId);
  if (!payment) throw new Error("Payment record no longer exists.");
  state.payments = state.payments.filter(row => row.id !== paymentId);
  state.partyLedger = state.partyLedger.filter(row => row.document !== payment.document);
  state.journal = state.journal.filter(row => row.document !== payment.document);
  return savePayment(state, { ...values, direction: payment.direction }, payment);
}

export function deletePayment(state, paymentId) {
  const payment = state.payments.find(row => row.id === paymentId);
  if (!payment) throw new Error("Payment record no longer exists.");
  const party = state.parties.find(row => row.id === payment.partyId);
  state.payments = state.payments.filter(row => row.id !== paymentId);
  state.partyLedger = state.partyLedger.filter(row => row.document !== payment.document);
  state.journal = state.journal.filter(row => row.document !== payment.document);
  audit(state, `Deleted ${payment.direction.toLowerCase()} ${payment.document}`, `${party?.name || "Unknown party"} · ${money(payment.amount)} · ${payment.paymentMethod || "Cash"}`);
}

export function updateChequeStatus(state, paymentId, status) {
  const payment = state.payments.find(row => row.id === paymentId && row.paymentMethod === "Cheque");
  if (!payment) throw new Error("Cheque record no longer exists.");
  const allowed = ["In hand", "Deposited", "Cleared", "Bounced"];
  if (!allowed.includes(status)) throw new Error("Select a valid cheque status.");
  const previous = payment.chequeStatus || "In hand";
  payment.chequeStatus = status;
  payment.chequeStatusUpdatedAt = new Date().toISOString();
  audit(state, `Marked cheque ${payment.chequeNumber || payment.document} ${status.toLowerCase()}`, `${previous} to ${status}`);
}

export function postBankTransfer(state, values) {
  const from = state.accounts.find(account => account.id === values.fromAccountId);
  const to = state.accounts.find(account => account.id === values.toAccountId);
  if (!from || !to) throw new Error("Select valid source and destination accounts.");
  if (from.id === to.id) throw new Error("Source and destination accounts must be different.");
  const amount = Number(values.amount);
  if (!(amount > 0)) throw new Error("Transfer amount must be greater than zero.");
  const document = id("IBT");
  state.bankTransfers.unshift({ id: id("BTR"), document, ...values, amount, status: "Posted", postedAt: new Date().toISOString() });
  postJournal(state, document, `Intra bank transfer: ${from.name} to ${to.name}`, [{ accountId: to.id, accountName: to.name, debit: amount, credit: 0 }, { accountId: from.id, accountName: from.name, debit: 0, credit: amount }], null, values.date);
  audit(state, `Posted intra bank transfer ${document}`, `${from.name} to ${to.name} · ${money(amount)}`);
  return document;
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
