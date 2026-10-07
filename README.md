# Supply Chain & Warehouse Logistics (SCWL)

Full-stack app on top of the DBMS mini-project schema.
**All business logic lives in SQL** (views, stored procedures, triggers). The Node API is a thin layer that validates input and calls them.

| Layer | Tech |
|---|---|
| Database | MySQL 8, plain SQL in `backend/sql/` |
| Backend | Node 20+, Express, `mysql2` (connection pool, raw SQL), `zod` |
| Frontend | Vite, React 18, TypeScript, Tailwind, React Query |

## Run it

Requires Node 20+ and MySQL 8 (with the `mysql` CLI on your PATH).

```bash
# 1. install
npm run setup

# 2. configure DB credentials
cp backend/.env.example backend/.env      # then edit DB_USER / DB_PASSWORD

# 3. create the database (schema + views + procedures + seed data)
npm --prefix backend run db:setup
#    or run the four files in backend/sql/ in order from MySQL Workbench

# 4a. development (two terminals)
npm --prefix backend run dev              # API  -> http://localhost:4000
npm run dev                               # UI   -> http://localhost:5173

# 4b. production (single process: API + built UI on port 4000)
npm run build && npm run server
```

## SQL files (`backend/sql/`)

| File | Contents |
|---|---|
| `01_schema.sql` | 9 original tables + `Stock_Movements`; AUTO_INCREMENT keys, ENUM status, timestamps, indexes |
| `02_views.sql` | the 5 original views (extended) + `vw_Warehouse_Utilization` |
| `03_routines.sql` | triggers and stored procedures (below) |
| `04_seed.sql` | your original sample data, same ids |

### Rules enforced inside the database
| Rule | Where |
|---|---|
| Warehouse stock can never exceed `max_capacity` | triggers `trg_inv_capacity_ins/upd` |
| Only Pending / Cancelled shipments can be deleted | trigger `trg_shipment_before_delete` |
| Receive / adjust stock, never below zero, always audited | `sp_adjust_stock` |
| Create shipment + items atomically (JSON array) | `sp_create_shipment` |
| Status workflow `Pending → Dispatched → In Transit → Delivered` (+ Cancel). Dispatch deducts stock with row locks (no overselling), cancel-after-dispatch returns it, timestamps and tracking log are written automatically | `sp_set_shipment_status` |
| Tracking log ids (`log_id` partial key) assigned safely per shipment | `sp_add_log`, `sp_log_internal` |

## API (`/api`)

| Area | Endpoints |
|---|---|
| Dashboard | `GET /dashboard`, `GET /lookups`, `GET /health` |
| Master data | `GET/POST /products, /suppliers, /warehouses, /carriers` · `PUT/DELETE /:id` · list supports `?q=&page=&limit=` |
| Supplier catalogue | `GET/POST /suppliers/:id/products` · `DELETE /suppliers/:id/products/:productId` |
| Inventory | `GET /inventory?warehouse_id=&low=1&q=` · `POST /inventory/adjust` · `PUT /inventory/threshold` · `GET /inventory/movements` |
| Shipments | `GET /shipments?status=&q=` · `POST /shipments` · `GET /shipments/:id` · `POST /shipments/:id/status` · `POST /shipments/:id/logs` · `DELETE /shipments/:id` |
| Public tracking | `GET /track/:id` (no prices) |

Errors are always `{ "error": { "code", "message" } }` — e.g. `INSUFFICIENT_STOCK`, `CAPACITY_EXCEEDED`, `INVALID_STATUS_TRANSITION`, `DUPLICATE`, `REFERENCED`.

## Why the backend stays responsive
- One shared **connection pool** (10 by default, `DB_POOL`), bounded queue, no per-request connections.
- **Pagination** on every list, with list + count queries run in parallel; dashboard runs 5 queries in parallel.
- **Indexes** on shipment status / warehouse / carrier and tracking logs; filtering happens in SQL.
- **gzip**, request timeout, graceful shutdown, `/api/health`.
- Frontend uses React Query caching, debounced search, and a single `/lookups` call for all dropdowns.

## Not included (see `docs/PRD.md` for the full vision)
Login / roles, purchase orders, live carrier/GPS integration.
