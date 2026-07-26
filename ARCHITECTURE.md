# Architecture and extension guide

## Layers

- `lib/schema.js`: versioned, additive ERP data contract.
- `lib/erp.js`: posting, stock, costing, journal and ledger rules.
- `lib/server/`: MongoDB connection, password/session security and persistence.
- `app/api/`: authenticated ERP, login/logout and administrator user endpoints.
- `components/ERPContext.js`: client synchronization and optimistic version handling.
- `components/forms` and `components/screens`: workflow UI.

## Invariants

- stock is the sum of signed stock movements; rack IDs may be empty for unassigned stock;
- every financial posting creates balanced journal lines;
- party ledger rows originate from invoices, purchases and payments;
- production keeps a BOM snapshot for historical traceability;
- MongoDB business state excludes passwords and user credentials;
- password hashes use scrypt with individual salts and sessions use signed HTTP-only cookies;
- writes include the last database version so stale clients cannot silently overwrite newer data;
- schema migration merges new defaults and preserves unknown historical fields.

## Safe expansion

Increase `SCHEMA_VERSION` when adding persisted fields and keep `migrateERP()` additive. Add new posting functions rather than mutating totals in UI components. For higher-volume production, split the current aggregate ERP document into MongoDB collections and execute stock, journal and ledger writes in a MongoDB transaction while preserving document IDs and migration scripts.

Good next modules include quotations/orders, purchase and sales returns, payment allocation, period closing, multi-branch inventory, quality control, batches/serials, payroll, maintenance, attachments and bank reconciliation.
