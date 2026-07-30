"use client";

import { useState } from "react";
import { useERP } from "../ERPContext";
import { addAccount, addItem, addParty, addRack, adjustStock, nextItemSku, transferStock, updateItem, updateParty, updateStockAdjustment } from "../../lib/erp";
import { dateNow } from "../../lib/schema";
import { Button, ErrorText, Field, FormActions, Modal, SearchableSelect } from "../UI";

function useSubmit(close, operation, permission) {
  const { mutate } = useERP();
  const [error, setError] = useState("");
  const submit = (event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    try { mutate((state) => operation(state, values), permission); close(); }
    catch (e) { setError(e.message); }
  };
  return { submit, error };
}

export function ItemForm({ close, defaultType = "Finished Good", item = null }) {
  const { state } = useERP();
  const rawOnly = (item?.type || defaultType) === "Raw Material";
  const [type, setType] = useState(item?.type || defaultType);
  const generatedSku = item?.sku || nextItemSku(state, type);
  const labourSuppliers = state.parties.filter(party => ["Supplier", "Both"].includes(party.type));
  const abuKiMazduri = labourSuppliers.find(party => party.name.trim().toLowerCase() === "abu ki mazduri");
  const labourSupplierId = item?.labourSupplierId || abuKiMazduri?.id || "";
  const { submit, error } = useSubmit(close, (s, f) => item ? updateItem(s, item.id, Object.fromEntries(f)) : addItem(s, Object.fromEntries(f)), "items");
  return <Modal title={item ? `Edit ${item.name}` : rawOnly ? "Add raw material" : "Add item or product"} eyebrow={rawOnly ? "RAW MATERIAL MASTER" : "ITEM MASTER"} close={close} wide><form onSubmit={submit}>
    <div className="form-grid three">
      <Field label={rawOnly ? "Raw material name" : "Item name"}><input name="name" defaultValue={item?.name || ""} required /></Field>
      <Field label="SKU / item code"><input name="sku" value={generatedSku} readOnly /></Field>
      {rawOnly ? <Field label="Item type"><input name="type" value="Raw Material" readOnly /></Field> : <Field label="Item type"><SearchableSelect name="type" value={type} onChange={e => setType(e.target.value)}><option>Finished Good</option><option>Consumable</option><option>Other</option></SearchableSelect></Field>}
      <Field label="Category"><input name="category" defaultValue={item?.category || ""} placeholder="Steel, bearing, hub..." /></Field>
      <Field label="Unit"><SearchableSelect name="unit" defaultValue={item?.unit || "Pieces"}><option>Pieces</option><option>Kg</option><option>Box</option></SearchableSelect></Field>
      <Field label="Minimum stock"><input name="minStock" type="number" min="0" step="0.01" defaultValue={item?.minStock || 0} /></Field>
      <Field label="Current / average cost"><input name="cost" type="number" min="0" step="0.01" defaultValue={item?.cost || 0} /></Field>
      <Field label="Default sale rate"><input name="saleRate" type="number" min="0" step="0.01" defaultValue={item?.saleRate || 0} /></Field>
      {!rawOnly && type === "Finished Good" && <>
        <Field label="Labour cost per unit"><input name="labourCost" type="number" min="0" step="0.01" defaultValue={item?.labourCost || 0} /></Field>
        <Field label="Laser marking cost per unit"><input name="laserMarkingCost" type="number" min="0" step="0.01" defaultValue={item?.laserMarkingCost || 0} /></Field>
        <Field label="Labour supplier account"><SearchableSelect name="labourSupplierId" defaultValue={labourSupplierId} searchPlaceholder="Search suppliers…"><option value="">Select supplier</option>{labourSuppliers.map(party => <option key={party.id} value={party.id}>{party.name}</option>)}</SearchableSelect></Field>
      </>}
      {!item&&<><Field label="Opening quantity"><input name="openingQty" type="number" min="0" step="0.01" defaultValue="0" /></Field><Field label="Opening stock rack (optional)"><SearchableSelect name="rackId"><option value="">No rack / unassigned stock</option>{state.racks.map(r => <option key={r.id} value={r.id}>{r.code} — {r.name}</option>)}</SearchableSelect></Field></>}
      <Field label="Barcode"><input name="barcode" defaultValue={item?.barcode || ""} /></Field>
      <Field label="Description"><input name="description" defaultValue={item?.description || ""} /></Field>
    </div>
    <p className="form-note">{type === "Finished Good" ? "Labour and laser rates are copied into each new invoice. Later product edits never change old invoices. Abu Ki Mazduri is selected automatically when that supplier exists." : item ? "Use a stock adjustment to change on-hand quantity; editing keeps the movement ledger intact." : "The SKU is generated from the item type and the next available sequence number."}</p>
    <ErrorText>{error}</ErrorText><FormActions close={close} submit={item ? "Save item changes" : rawOnly ? "Create raw material" : "Create item"} />
  </form></Modal>;
}

export function PartyForm({ close, defaultType = "Customer", party = null }) {
  const { submit, error } = useSubmit(close, (s, f) => party ? updateParty(s, party.id, Object.fromEntries(f)) : addParty(s, Object.fromEntries(f)), "parties");
  const isSupplier = (party?.type || defaultType) === "Supplier";
  return <Modal title={party ? `Edit ${party.name}` : isSupplier ? "Add supplier" : "Add customer"} eyebrow={isSupplier ? "SUPPLIER / VENDOR MASTER" : "CUSTOMER / PURCHASER MASTER"} close={close} wide><form onSubmit={submit}><div className="form-grid three"><Field label={isSupplier ? "Supplier company or individual" : "Customer company or individual"}><input name="name" defaultValue={party?.name || ""} required /></Field><Field label="Relationship"><SearchableSelect name="type" defaultValue={party?.type || defaultType}><option value="Customer">Customer / purchaser / buyer</option><option value="Supplier">Supplier / raw-material vendor</option><option value="Both">Both customer and supplier</option></SearchableSelect></Field><Field label="Phone"><input name="phone" defaultValue={party?.phone || ""} /></Field><Field label="Email"><input name="email" type="email" defaultValue={party?.email || ""} /></Field><Field label="Tax / NTN number"><input name="taxNumber" defaultValue={party?.taxNumber || ""} /></Field><Field label="Credit limit"><input name="creditLimit" type="number" min="0" defaultValue={party?.creditLimit || 0} /></Field><Field label="Opening balance"><input name="openingBalance" type="number" min="0" defaultValue={party?.openingBalance || 0} /></Field><Field label="Opening date"><input name="openingDate" type="date" defaultValue={party?.openingDate || dateNow()} /></Field><Field label="Payment terms (days)"><input name="paymentTerms" type="number" min="0" defaultValue={party?.paymentTerms || 0} /></Field><Field label="Address"><input name="address" defaultValue={party?.address || ""} /></Field><Field label="City"><input name="city" defaultValue={party?.city || ""} /></Field><Field label="Contact person"><input name="contactPerson" defaultValue={party?.contactPerson || ""} /></Field></div><ErrorText>{error}</ErrorText><FormActions close={close} submit={party ? "Save party changes" : isSupplier ? "Create supplier" : "Create customer"} /></form></Modal>;
}

export function RackForm({ close }) {
  const { submit, error } = useSubmit(close, (s, f) => addRack(s, Object.fromEntries(f)), "racks");
  return <Modal title="Add rack or location" eyebrow="WAREHOUSE CONTROL" close={close}><form onSubmit={submit}><div className="form-grid two"><Field label="Rack code"><input name="code" placeholder="R-A-01" required /></Field><Field label="Rack name"><input name="name" placeholder="Raw steel rack" required /></Field><Field label="Warehouse"><input name="warehouse" required /></Field><Field label="Zone / aisle"><input name="zone" /></Field><Field label="Capacity"><input name="capacity" type="number" min="0" defaultValue="0" /></Field><Field label="Capacity unit"><input name="capacityUnit" placeholder="Kg / Pieces" /></Field></div><ErrorText>{error}</ErrorText><FormActions close={close} submit="Create rack" /></form></Modal>;
}

export function AccountForm({ close }) {
  const { submit, error } = useSubmit(close, (s, f) => addAccount(s, Object.fromEntries(f)), "accounts");
  return <Modal title="Add cash or bank account" eyebrow="FINANCIAL MASTER" close={close}><form onSubmit={submit}><div className="form-grid two"><Field label="Account name"><input name="name" required /></Field><Field label="Account type"><SearchableSelect name="type"><option>Cash</option><option>Bank</option><option>Wallet</option></SearchableSelect></Field><Field label="Account number"><input name="accountNumber" /></Field><Field label="Opening balance"><input name="openingBalance" type="number" step="0.01" defaultValue="0" /></Field></div><ErrorText>{error}</ErrorText><FormActions close={close} submit="Create account" /></form></Modal>;
}

export function StockActionForm({ close, mode = "adjust", itemScope = "all", movement = null }) {
  const { state, mutate } = useERP();
  const [error, setError] = useState("");
  const availableItems = state.items.filter(item => itemScope === "raw" ? item.type === "Raw Material" : itemScope === "items" ? item.type !== "Raw Material" : true);
  const rawAdjustment = mode === "adjust" && itemScope === "raw";
  const submit = (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const fn = movement ? (state, input) => updateStockAdjustment(state, movement.id, input) : mode === "adjust" ? adjustStock : transferStock;
      mutateState(fn, values);
    } catch (e) { setError(e.message); }
  };
  const mutateState = (fn, values) => { mutate(s => fn(s, values), "stock"); close(); };
  return <Modal title={movement ? `Edit ${movement.document}` : mode === "adjust" ? rawAdjustment ? "Raw material adjustment" : "Stock adjustment" : "Rack transfer"} eyebrow={rawAdjustment ? "RAW MATERIAL MOVEMENT" : "CONTROLLED STOCK MOVEMENT"} close={close}><form onSubmit={submit}><div className="form-grid two"><Field label={rawAdjustment ? "Raw material" : "Item"}><SearchableSelect name="itemId" defaultValue={movement?.itemId || ""} required><option value="">Select {rawAdjustment ? "raw material" : "item"}</option>{availableItems.map(i => <option key={i.id} value={i.id}>{i.sku} — {i.name}</option>)}</SearchableSelect></Field>{mode === "adjust" ? <><Field label="Adjustment date"><input name="date" type="date" defaultValue={movement?.date || dateNow()} required /></Field><Field label="Rack (optional)"><SearchableSelect name="rackId" defaultValue={movement?.rackId || ""}><option value="">No rack / unassigned</option>{state.racks.map(r => <option key={r.id} value={r.id}>{r.code} — {r.name}</option>)}</SearchableSelect></Field><Field label="Direction"><SearchableSelect name="direction" defaultValue={movement?.quantity < 0 ? "Decrease" : "Increase"}><option>Increase</option><option>Decrease</option></SearchableSelect></Field><Field label="Quantity"><input name="quantity" type="number" min="0.01" step="0.01" defaultValue={movement ? Math.abs(Number(movement.quantity)) : ""} required /></Field><Field label="Mandatory reason"><input name="reason" defaultValue={movement?.note || ""} required /></Field></> : <><Field label="From rack"><SearchableSelect name="fromRackId" required><option value="">Select source</option>{state.racks.map(r => <option key={r.id} value={r.id}>{r.code}</option>)}</SearchableSelect></Field><Field label="To rack"><SearchableSelect name="toRackId" required><option value="">Select destination</option>{state.racks.map(r => <option key={r.id} value={r.id}>{r.code}</option>)}</SearchableSelect></Field><Field label="Quantity"><input name="quantity" type="number" min="0.01" step="0.01" required /></Field></>}</div><ErrorText>{error}</ErrorText><FormActions close={close} submit={movement ? "Save adjustment" : mode === "adjust" ? rawAdjustment ? "Post raw-material adjustment" : "Post stock adjustment" : "Transfer stock"} /></form></Modal>;
}
