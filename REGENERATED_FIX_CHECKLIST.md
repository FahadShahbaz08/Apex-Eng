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
- Raw materials is a separate sidebar module.
- Items & stock remains the general item, rack, adjustment and stock-movement module.
- Raw-material creation locks the item type to Raw Material.
- General item creation excludes Raw Material from its item-type choices.
- SKU/item codes are generated automatically using type-specific sequences.
- Existing MongoDB data is preserved by additive schema migration version 6.

Validation completed:

- Clean production build passed.
- Invoice edit reversal/reposting engine passed stock, party-ledger and journal assertions.
- The regenerated active application loaded and synchronized with MongoDB.
