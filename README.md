# CoreInventory

A modular Inventory Management System (IMS) that digitizes and streamlines stock-related operations using a centralized, real-time web application.

CoreInventory replaces manual registers, spreadsheets, and scattered tracking methods with one consistent operational flow for inventory teams.

Mockup reference: https://link.excalidraw.com/l/65VNwvy7c4X/3ENvQFu9o8R

---

## Problem Statement

Businesses often manage inventory through disconnected tools and manual processes, which leads to:

- Inaccurate stock levels
- Delayed updates between teams
- Missing audit trails
- Slow decision-making for replenishment and fulfillment

CoreInventory addresses this through a modular system with clear operational workflows for receiving, delivering, transferring, and adjusting stock.

---

## Target Users

- Inventory Managers
  - Manage incoming and outgoing stock
  - Validate critical operations
  - Configure products, warehouses, and locations

- Warehouse Staff
  - Perform transfers, shelving, picking, and counting
  - Execute day-to-day stock handling

---

## Core Capabilities

### 1) Authentication and Access Control

- Signup and login
- OTP-based password reset
- JWT-based API authentication
- Role-based authorization (manager, staff)

### 2) Dashboard

Landing view provides a snapshot of inventory operations.

KPIs include:

- Total products in stock
- Low stock and out-of-stock items
- Pending receipts
- Pending deliveries
- Internal transfers scheduled

Filtering supports:

- Document type: receipts, deliveries, transfers, adjustments
- Status: draft, waiting, ready, done, cancelled
- Warehouse or location
- Product category

### 3) Product Management

- Create and update products with:
  - Name
  - SKU/code
  - Category
  - Unit of measure
  - Optional initial stock
- Category management
- Reorder rules
- Stock visibility endpoints

### 4) Receipts (Incoming Stock)

Used when stock arrives from vendors.

Typical flow:

1. Create a receipt
2. Add product lines and quantities
3. Validate receipt
4. System increases stock and writes immutable move records

Example:

- Receive 50 units of Steel Rods -> stock +50

### 5) Delivery Orders (Outgoing Stock)

Used when stock leaves the warehouse.

Typical flow:

1. Create delivery
2. Add product lines and quantities
3. Validate delivery
4. System decreases stock and writes move records

Example:

- Ship 10 chairs -> stock -10

### 6) Internal Transfers

Move stock between locations and warehouses while preserving total quantity.

Examples:

- Main Warehouse -> Production Floor
- Rack A -> Rack B
- Warehouse 1 -> Warehouse 2

### 7) Stock Adjustments

Reconcile physical counts against recorded quantities.

Typical flow:

1. Select product/location
2. Enter counted quantity
3. Validate adjustment
4. System updates stock and logs adjustment reason and movement

### 8) Move History (Ledger)

Every validated inventory movement is recorded for traceability and auditing.

---

## Inventory Flow Example

1. Receive goods from vendor
   - Receive 100 kg steel
   - Stock: +100

2. Move stock internally
   - Main Store -> Production Rack
   - Total stock unchanged, location balance updated

3. Deliver to customer
   - Deliver 20 kg steel
   - Stock: -20

4. Adjust damaged stock
   - Mark 3 kg as damaged
   - Stock: -3

All events are logged in the stock ledger.

---

## Repository Structure

```text
CoreInventory/
  client/    # React + Vite frontend
  server/    # Express + MongoDB backend
  CoreInventory_Frontend_Guide.txt
  CoreInventory_SystemDesign.txt
  CoreInventory_Mockups.pdf
```

---

## Tech Stack

### Frontend

- React 18 + Vite
- React Router
- React Query
- React Hook Form
- Zustand
- Tailwind CSS
- Axios

### Backend

- Node.js + Express
- MongoDB + Mongoose
- JWT authentication
- bcrypt password hashing
- express-validator
- Helmet + CORS + rate limiting

---

## Frontend Route Map

### Public

- /login
- /signup
- /reset-password

### Protected

- /dashboard
- /products
- /products/new
- /products/:id/edit
- /products/categories
- /products/reorder-rules
- /operations/receipts
- /operations/receipts/new
- /operations/receipts/:id
- /operations/deliveries
- /operations/deliveries/new
- /operations/deliveries/:id
- /operations/transfers
- /operations/transfers/new
- /operations/transfers/:id
- /operations/adjustments
- /operations/adjustments/new
- /operations/adjustments/:id
- /operations/moves
- /settings/warehouses
- /settings/locations

Role notes:

- Manager-only areas: product catalog, receipts, deliveries, settings
- Shared manager/staff areas: transfers, adjustments, move history

---

## Backend API Overview

Base path: /api

### Auth

- POST /auth/register
- POST /auth/login
- POST /auth/logout
- POST /auth/send-otp
- POST /auth/verify-otp
- POST /auth/reset-password
- GET /auth/me

### Dashboard

- GET /dashboard/kpis
- GET /dashboard/operations-summary
- GET /dashboard/alerts

### Products

- GET /products
- POST /products
- GET /products/:id
- PUT /products/:id
- DELETE /products/:id
- GET /products/:id/stock
- GET /products/categories
- POST /products/categories
- PUT /products/categories/:id
- GET /products/reorder-rules
- POST /products/reorder-rules
- PUT /products/reorder-rules/:id
- DELETE /products/reorder-rules/:id

### Operations

- Receipts
  - GET /receipts
  - POST /receipts
  - GET /receipts/:id
  - PUT /receipts/:id
  - POST /receipts/:id/validate
  - POST /receipts/:id/cancel
  - POST /receipts/:id/return

- Deliveries
  - GET /deliveries
  - POST /deliveries
  - GET /deliveries/:id
  - PUT /deliveries/:id
  - POST /deliveries/:id/validate
  - POST /deliveries/:id/cancel
  - POST /deliveries/:id/return

- Transfers
  - GET /transfers
  - POST /transfers
  - GET /transfers/:id
  - PUT /transfers/:id
  - POST /transfers/:id/validate
  - POST /transfers/:id/cancel

- Adjustments
  - GET /adjustments
  - POST /adjustments
  - GET /adjustments/:id
  - POST /adjustments/:id/validate
  - POST /adjustments/:id/cancel

### Audit and Settings

- GET /moves
- GET /moves/:id
- GET /warehouses
- POST /warehouses
- GET /warehouses/:id
- PUT /warehouses/:id
- DELETE /warehouses/:id
- GET /locations
- POST /locations
- GET /locations/:id
- PUT /locations/:id
- DELETE /locations/:id

Health check:

- GET /api/health

---

## Local Development Setup

## Prerequisites

- Node.js 18+
- npm 9+
- MongoDB (local or hosted)

## 1) Clone

```bash
git clone <your-repo-url>
cd CoreInventory
```

## 2) Setup Backend

```bash
cd server
npm install
```

Create server/.env (or copy from server/.env.example):

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/coreinventory
JWT_SECRET=your_jwt_secret_key_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_here
JWT_EXPIRE=1h
JWT_REFRESH_EXPIRE=7d

GMAIL_ID=your_gmail@gmail.com
GMAIL_PASSWORD=your_gmail_app_password

NODE_ENV=development
```

Run backend:

```bash
npm run dev
```

## 3) Setup Frontend

```bash
cd ../client
npm install
```

Create client/.env:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

Run frontend:

```bash
npm run dev
```

Build frontend:

```bash
npm run build
```

---

## Scripts

### Client

- npm run dev
- npm run build
- npm run preview

### Server

- npm run dev
- npm start

---

## Security and Reliability Notes

- Password hashing with bcrypt
- JWT access and refresh tokens
- API route protection middleware
- Role-based authorization
- Auth rate limiting
- Centralized error handling middleware
- Helmet and CORS enabled

---

## Current Scope vs Roadmap

Implemented in this repository:

- End-to-end modules for products, receipts, deliveries, transfers, adjustments
- Warehouse/location settings
- Dashboard summaries and alerts endpoints
- Move history ledger

Potential next improvements:

- Automated tests (unit/integration/e2e)
- CI/CD pipeline and quality gates
- Stronger API documentation (OpenAPI/Swagger)
- Multi-tenant support and granular permissions
- Background jobs for notifications and replenishment

---

## Documentation References

- CoreInventory_Frontend_Guide.txt
- CoreInventory_SystemDesign.txt
- CoreInventory_Mockups.pdf

---

## License

ISC
