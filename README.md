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
- edit and delete actions for BOMs, products, raw materials, customers and suppliers
- dependency-aware deletion safeguards prevent historical BOM, stock and accounting references from being orphaned
- stock corrections remain auditable adjustments; deleting an unused item also removes only its standalone opening/adjustment movements, while source-document movements remain protected
- optional rack assignment throughout stock, purchase, sale and production
- raw materials, finished goods, stock movements and rack transfers
- separate Customers and Suppliers directories; parties marked Both appear in both directories
- BOM versions with unlimited materials and custom conversion costs
- production consumption, finished receipt and unit-cost calculation
- purchase invoices and vendor payables
- printable sales invoices and customer receivables
- editable posted invoices with stock, ledger and journal reversal/reposting
- deletable sales invoices with automatic reversal of their stock movements, customer ledger and journal posting
- pending customer orders with multi-product quantities, unit prices and required dates
- Pending orders appears directly below Sales & invoices in the sidebar
- customer receipts, supplier payments, expenses, cash and bank books
- Cheque is the default party-payment type, with cheque number/date fields and due/overdue dashboard reminders
- Cash & bank includes a clickable Cheques in hand register with customer, amount, dates, account, reference and due-state details
- cheque workflow statuses include In hand, Deposited, Cleared and Bounced while preserving complete cheque history
- customer receipts and vendor payments in the payment register can both be edited or deleted; linked party-ledger and journal postings are safely reversed/reposted and every change is audit logged
- post-dated vendor cheques reduce the supplier payable immediately, but the selected cash/bank balance is reduced automatically only on the cheque date
- pending customer orders can be reopened and edited without changing their order number or workflow status
- finished products support editable labour and laser-marking cost per unit plus a labour supplier; each new invoice snapshots those rates and creates a detailed supplier payable without changing older invoices
- the supplier named `Abu Ki Mazduri` is selected automatically as the labour account when it exists
- production and expense forms use consistent searchable dropdowns for BOMs, racks, expense categories and cash/bank accounts
- Cash, bank transfer, online payment and other payment methods remain available
- balanced intra-bank transfers move value between any two cash/bank accounts and appear in their own register
- overall, party, account and invoice ledgers
- itemized party-ledger lines with quantity, unit price and product total
- a running balance on every individual product line of a multi-product invoice
- newest-first party and account ledger statements with the latest running balance at the top
- newest-first overall ledger, account ledger and invoice register; the verified party-ledger balance behavior is preserved
- print-ready PDF export for the complete overall ledger and any selected customer or supplier ledger
- customer-ledger Received and supplier-ledger Sent presentation
- quantity and item details in party ledgers
- profit, stock and operational reports with CSV exports
- administrator and limited-access users with server-enforced permissions
- administrator accountability log records the signed-in admin's name, username, role, time, action and detail
- searchable option filtering on every dropdown, including dynamically opened transaction forms
- dropdown search uses one integrated combobox field: click the current selection, type, and choose a filtered result
- shared MongoDB state, optimistic concurrency checking and periodic synchronization
- fail-closed connectivity guard checks both the browser network and a real MongoDB ping every five seconds
- full-screen offline safety lock prevents edits when Wi-Fi exists without internet or MongoDB is unreachable
- failed saves roll the interface back to the last server-confirmed snapshot instead of leaving unsafe unsaved state
- JSON backup/restore and additive schema migration
- monochrome light and dark themes
- dedicated raw-material inventory section alongside general item/stock management
- separate adjustment pickers: raw-material adjustments only list raw materials, while item/stock adjustments exclude raw materials
- locked Raw Material classification in the raw-material form; general Items never offers Raw Material
- automatic type-based SKU generation (`RM-0001`, `FG-0001`, `CON-0001`, `ITM-0001`)
- application typography is scaled to 1.3× with responsive wrapping for forms, buttons and tables
- workflow-ordered sidebar: Dashboard, Raw materials, Suppliers, BOM, Production, Purchases, Items & stock, Customers, Sales & invoices, Pending orders, Cash & bank, Ledger, Expenses, Reports, Settings & backup

## Data safety and expansion

The MongoDB ERP document has a `schemaVersion` and optimistic `version`. `migrateERP()` adds new defaults without deleting existing collections or fields. Future modules should append documents and movements through `lib/erp.js`; never edit calculated balances directly. Take regular MongoDB backups plus application JSON exports before schema or posting-engine changes.

Important: this application provides an ERP foundation, not jurisdiction-specific audited accounting compliance. Before production use, add database-level transactional posting, period locks, tax configuration, automated database backups and an independent accounting/security review.
