# Apex Engineering Manufacturing ERP

Expandable black-and-white Manufacturing ERP built with Next.js and standard JavaScript. It starts without dummy business data and stores shared business data in MongoDB.

## Configure and run

1. Copy `.env.example` to `.env.local`.
2. Set `MONGODB_URI`, `MONGODB_DB`, a long random `SESSION_SECRET`, and the administrator credentials.
3. Install and start:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Unless overridden in the environment, the initial login is `admin` / `admin`. Change it before deployment.

## Vercel

Import the complete source repository into Vercel; do not upload `.next`. Add the same five environment variables in Project Settings → Environment Variables, then deploy. MongoDB Atlas must allow connections from the deployed application.

## Included workflows

- items with Pieces/Kg/Box units (Pieces is default)
- optional rack assignment throughout stock, purchase, sale and production
- raw materials, finished goods, stock movements and rack transfers
- parties as customers, suppliers or both
- BOM versions with unlimited materials and custom conversion costs
- production consumption, finished receipt and unit-cost calculation
- purchase invoices and vendor payables
- printable sales invoices and customer receivables
- editable posted invoices with stock, ledger and journal reversal/reposting
- pending customer orders with multi-product quantities, unit prices and required dates
- customer receipts, supplier payments, expenses, cash and bank books
- overall, party, account and invoice ledgers
- itemized party-ledger lines with quantity, unit price and product total
- customer-ledger Received and supplier-ledger Sent presentation
- quantity and item details in party ledgers
- profit, stock and operational reports with CSV exports
- administrator and limited-access users with server-enforced permissions
- shared MongoDB state, optimistic concurrency checking and periodic synchronization
- JSON backup/restore and additive schema migration
- monochrome light and dark themes
- dedicated raw-material inventory section alongside general item/stock management
- locked Raw Material classification in the raw-material form; general Items never offers Raw Material
- automatic type-based SKU generation (`RM-0001`, `FG-0001`, `CON-0001`, `ITM-0001`)

## Data safety and expansion

The MongoDB ERP document has a `schemaVersion` and optimistic `version`. `migrateERP()` adds new defaults without deleting existing collections or fields. Future modules should append documents and movements through `lib/erp.js`; never edit calculated balances directly. Take regular MongoDB backups plus application JSON exports before schema or posting-engine changes.

Important: this application provides an ERP foundation, not jurisdiction-specific audited accounting compliance. Before production use, add database-level transactional posting, period locks, tax configuration, automated database backups and an independent accounting/security review.
