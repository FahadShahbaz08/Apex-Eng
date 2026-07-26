"use client";

import { useState } from "react";
import { useERP } from "../ERPContext";
import { addAccount, addItem, addParty, addRack, adjustStock, nextItemSku, transferStock } from "../../lib/erp";
import { dateNow } from "../../lib/schema";
import { Button, ErrorText, Field, FormActions, Modal } from "../UI";

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

export function ItemForm({ close, defaultType = "Finished Good" }) {
  const { state } = useERP();
  const rawOnly = defaultType === "Raw Material";
  const [type, setType] = useState(defaultType);
  const generatedSku = nextItemSku(state, type);
  const { submit, error } = useSubmit(close, (s, f) => addItem(s, Object.fromEntries(f)), "items");
  return <Modal title={rawOnly ? "Add raw material" : "Add item or product"} eyebrow={rawOnly ? "RAW MATERIAL MASTER" : "ITEM MASTER"} close={close} wide><form onSubmit={submit}><div className="form-grid three"><Field label={rawOnly ? "Raw material name" : "Item name"}><input name="name" required /></Field><Field label="SKU / item code (automatic)"><input name="sku" value={generatedSku} readOnly /></Field>{rawOnly ? <Field label="Item type"><input name="type" value="Raw Material" readOnly /></Field> : <Field label="Item type"><select name="type" value={type} onChange={e => setType(e.target.value)}><option>Finished Good</option><option>Consumable</option><option>Other</option></select></Field>}<Field label="Category"><input name="category" placeholder="Steel, bearing, hub..." /></Field><Field label="Unit"><select name="unit" defaultValue="Pieces"><option>Pieces</option><option>Kg</option><option>Box</option></select></Field><Field label="Minimum stock"><input name="minStock" type="number" min="0" step="0.01" defaultValue="0" /></Field><Field label="Current / average cost"><input name="cost" type="number" min="0" step="0.01" defaultValue="0" /></Field><Field label="Default sale rate"><input name="saleRate" type="number" min="0" step="0.01" defaultValue="0" /></Field><Field label="Opening quantity"><input name="openingQty" type="number" min="0" step="0.01" defaultValue="0" /></Field><Field label="Opening stock rack (optional)"><select name="rackId"><option value="">No rack / unassigned stock</option>{state.racks.map(r => <option key={r.id} value={r.id}>{r.code} — {r.name}</option>)}</select></Field><Field label="Barcode"><input name="barcode" /></Field><Field label="Description"><input name="description" /></Field></div><p className="form-note">The SKU is generated from the item type and the next available sequence number.</p><ErrorText>{error}</ErrorText><FormActions close={close} submit={rawOnly ? "Create raw material" : "Create item"} /></form></Modal>;
}

export function PartyForm({ close }) {
  const { submit, error } = useSubmit(close, (s, f) => addParty(s, Object.fromEntries(f)), "parties");
  return <Modal title="Add business party" eyebrow="CUSTOMER / PURCHASER / VENDOR MASTER" close={close} wide><form onSubmit={submit}><div className="form-grid three"><Field label="Company or individual name"><input name="name" required /></Field><Field label="Relationship"><select name="type"><option value="Customer">Customer / purchaser / buyer</option><option value="Supplier">Supplier / raw-material vendor</option><option value="Both">Both customer and supplier</option></select></Field><Field label="Phone"><input name="phone" /></Field><Field label="Email"><input name="email" type="email" /></Field><Field label="Tax / NTN number"><input name="taxNumber" /></Field><Field label="Credit limit"><input name="creditLimit" type="number" min="0" defaultValue="0" /></Field><Field label="Opening balance"><input name="openingBalance" type="number" min="0" defaultValue="0" /></Field><Field label="Opening date"><input name="openingDate" type="date" defaultValue={dateNow()} /></Field><Field label="Payment terms (days)"><input name="paymentTerms" type="number" min="0" defaultValue="0" /></Field><Field label="Address"><input name="address" /></Field><Field label="City"><input name="city" /></Field><Field label="Contact person"><input name="contactPerson" /></Field></div><ErrorText>{error}</ErrorText><FormActions close={close} submit="Create party" /></form></Modal>;
}

export function RackForm({ close }) {
  const { submit, error } = useSubmit(close, (s, f) => addRack(s, Object.fromEntries(f)), "racks");
  return <Modal title="Add rack or location" eyebrow="WAREHOUSE CONTROL" close={close}><form onSubmit={submit}><div className="form-grid two"><Field label="Rack code"><input name="code" placeholder="R-A-01" required /></Field><Field label="Rack name"><input name="name" placeholder="Raw steel rack" required /></Field><Field label="Warehouse"><input name="warehouse" required /></Field><Field label="Zone / aisle"><input name="zone" /></Field><Field label="Capacity"><input name="capacity" type="number" min="0" defaultValue="0" /></Field><Field label="Capacity unit"><input name="capacityUnit" placeholder="Kg / Pieces" /></Field></div><ErrorText>{error}</ErrorText><FormActions close={close} submit="Create rack" /></form></Modal>;
}

export function AccountForm({ close }) {
  const { submit, error } = useSubmit(close, (s, f) => addAccount(s, Object.fromEntries(f)), "accounts");
  return <Modal title="Add cash or bank account" eyebrow="FINANCIAL MASTER" close={close}><form onSubmit={submit}><div className="form-grid two"><Field label="Account name"><input name="name" required /></Field><Field label="Account type"><select name="type"><option>Cash</option><option>Bank</option><option>Wallet</option></select></Field><Field label="Account number"><input name="accountNumber" /></Field><Field label="Opening balance"><input name="openingBalance" type="number" step="0.01" defaultValue="0" /></Field></div><ErrorText>{error}</ErrorText><FormActions close={close} submit="Create account" /></form></Modal>;
}

export function StockActionForm({ close, mode = "adjust" }) {
  const { state, mutate } = useERP();
  const [error, setError] = useState("");
  const submit = (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const fn = mode === "adjust" ? adjustStock : transferStock;
      mutateState(fn, values);
    } catch (e) { setError(e.message); }
  };
  const mutateState = (fn, values) => { mutate(s => fn(s, values), "stock"); close(); };
  return <Modal title={mode === "adjust" ? "Stock adjustment" : "Rack transfer"} eyebrow="CONTROLLED STOCK MOVEMENT" close={close}><form onSubmit={submit}><div className="form-grid two"><Field label="Item"><select name="itemId" required><option value="">Select item</option>{state.items.map(i => <option key={i.id} value={i.id}>{i.sku} — {i.name}</option>)}</select></Field>{mode === "adjust" ? <><Field label="Rack (optional)"><select name="rackId"><option value="">No rack / unassigned</option>{state.racks.map(r => <option key={r.id} value={r.id}>{r.code} — {r.name}</option>)}</select></Field><Field label="Direction"><select name="direction"><option>Increase</option><option>Decrease</option></select></Field><Field label="Quantity"><input name="quantity" type="number" min="0.01" step="0.01" required /></Field><Field label="Mandatory reason"><input name="reason" required /></Field></> : <><Field label="From rack"><select name="fromRackId" required><option value="">Select source</option>{state.racks.map(r => <option key={r.id} value={r.id}>{r.code}</option>)}</select></Field><Field label="To rack"><select name="toRackId" required><option value="">Select destination</option>{state.racks.map(r => <option key={r.id} value={r.id}>{r.code}</option>)}</select></Field><Field label="Quantity"><input name="quantity" type="number" min="0.01" step="0.01" required /></Field></>}</div><ErrorText>{error}</ErrorText><FormActions close={close} submit={mode === "adjust" ? "Post adjustment" : "Transfer stock"} /></form></Modal>;
}
