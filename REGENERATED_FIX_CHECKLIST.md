# Apex Engineering ERP — Regenerated Fix Checklist

This source package was regenerated after clearing the active project's `.next` cache and rebuilding the exact folder serving `http://localhost:3000`.

Verified in the running application:

- Sales register contains **View / print** and **Edit** actions.
- Invoice preview and printable document contain Item, Quantity, Price per unit and Line total; Rack is removed.
- Party ledger has no Description column.
- Multi-item invoices render as separate product lines.
- Party ledger includes Quantity, Price per unit and Product total.
- Invoice can be opened from the ledger and edited from its popup.
- Pending orders is a sidebar module with customer, multi-product lines, quantity, unit price, totals, dates and status.
- Pending orders is positioned directly below Sales & invoices in the sidebar.
- Raw materials is a separate sidebar module.
- Items & stock remains the general item, rack, adjustment and stock-movement module.
- Raw-material creation locks the item type to Raw Material.
- General item creation excludes Raw Material from its item-type choices.
- Raw-material adjustments only allow Raw Material items; Items & stock adjustments exclude Raw Material items.
- Customers and Suppliers are separate, dedicated sidebar directories; Both-role parties remain visible in each.
- Sidebar modules follow the requested manufacturing and accounting workflow order.
- Raw materials is immediately after Dashboard, Suppliers is next, and Customers is immediately before Sales & invoices.
- Every product row in a multi-product invoice shows its cumulative running balance.
- Party-ledger running-balance behavior is unchanged; overall ledger, account ledger and invoices are newest-first.
- Every dropdown includes a searchable option filter, including dropdowns added when a modal opens.
- Sales invoices can be deleted from the register or invoice popup, reversing stock, party-ledger and journal postings.
- Audit entries identify the signed-in administrator by name, username and role, so actions from multiple admins are attributable.
- BOMs, finished products, raw materials, customers and suppliers have edit/delete controls with transaction-history safeguards.
- Stock corrections use auditable adjustments; deleting an unused item removes only its standalone stock records, while purchase, sale, production and transfer history stays protected.
- Cheque is the default payment method and requires cheque date/number; due and overdue cheques appear on the dashboard.
- Intra-bank transfers post one balanced journal entry and update both selected account balances.
- Searchable dropdowns are single integrated combobox fields rather than separate search and selection controls.
- Typography and controls use the requested 1.3× scale with responsive wrapping.
- PDF output is available for the complete overall ledger and selected customer/supplier statements.
- SKU/item codes are generated automatically using type-specific sequences.
- Existing MongoDB data is preserved by additive schema migration version 7.

Validation completed:

- Clean production build passed.
- Invoice edit reversal/reposting engine passed stock, party-ledger and journal assertions.
- Invoice deletion reversal and two-administrator attribution assertions passed.
- Master-data editing/deletion, stock-adjustment correction/reversal, cheque storage, schema-v7 migration and intra-bank balance assertions passed.
- The regenerated active application loaded and synchronized with MongoDB.
