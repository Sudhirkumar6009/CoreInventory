<div align="center">

<h1>📦 CoreInventory</h1>

<p><strong>A modular, real-time Inventory Management System that replaces scattered spreadsheets and manual registers with one consistent operational flow.</strong></p>

<p>
  <img src="https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/MongoDB-Mongoose-47A248?style=for-the-badge&logo=mongodb&logoColor=white" />
  <img src="https://img.shields.io/badge/Express-5-000000?style=for-the-badge&logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/TailwindCSS-3-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/License-ISC-blue?style=for-the-badge" />
</p>

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Problem Statement](#-problem-statement)
- [Target Users](#-target-users)
- [Core Modules](#-core-modules)
- [Tech Stack](#-tech-stack)
- [Repository Structure](#-repository-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [API Reference](#-api-reference)
- [Frontend Routes](#-frontend-routes)
- [Data Models](#-data-models)
- [Security](#-security)
- [Scripts](#-scripts)
- [Roadmap](#-roadmap)
- [Documentation](#-documentation)
- [License](#-license)

---

## 🧭 Overview

**CoreInventory** is a full-stack, modular Inventory Management System (IMS) built to digitize and streamline stock-related operations through a centralized, real-time web application.

It handles the complete lifecycle of stock: receiving goods from vendors, moving stock between locations, delivering to customers, and reconciling physical counts — with every validated movement written to an immutable audit ledger.

---

## 🔥 Problem Statement

Businesses typically manage inventory through disconnected tools — spreadsheets, paper registers, or siloed apps — which leads to:

| Pain Point | Impact |
|---|---|
| Inaccurate stock levels | Overstocking or stockouts |
| Delayed inter-team updates | Fulfillment errors |
| Missing audit trails | Compliance risks |
| Slow replenishment decisions | Revenue loss |

CoreInventory addresses each of these through clearly defined operational workflows and a unified data model.

---

## 👥 Target Users

| Role | Responsibilities |
|---|---|
| **Inventory Manager** | Configure products, warehouses & locations; validate receipts & deliveries; oversee all operations |
| **Warehouse Staff** | Execute transfers, adjustments, shelving & picking; perform day-to-day stock handling |

---

## 🧩 Core Modules

### 1. Authentication & Access Control
- Secure signup and login
- OTP-based password reset via email
- JWT access + refresh token authentication
- Role-based authorization (`manager` / `staff`)

### 2. Dashboard
Real-time operational snapshot with KPIs:
- Total products in stock
- Low-stock and out-of-stock alerts
- Pending receipts, deliveries, and scheduled transfers

**Filter by:** document type · status · warehouse · location · product category

### 3. Product Management
- Create and edit products with SKU, category, unit of measure, and optional initial stock
- Category management
- Configurable reorder rules per product/location
- Stock visibility per product and location

### 4. Receipts *(Incoming Stock)*
Stock arrival workflow:
```
Create Receipt → Add Lines → Validate → Stock +qty | Move Record Written
```
> Example: Receive 50 units of Steel Rods → stock **+50**

### 5. Delivery Orders *(Outgoing Stock)*
Stock dispatch workflow:
```
Create Delivery → Add Lines → Validate → Stock −qty | Move Record Written
```
> Example: Ship 10 Chairs → stock **−10**

### 6. Internal Transfers
Move stock between any combination of locations or warehouses while preserving total on-hand quantity.
> Examples: `Main Warehouse → Production Floor` · `Rack A → Rack B` · `Warehouse 1 → Warehouse 2`

### 7. Stock Adjustments
Reconcile physical counts against system quantities:
```
Select Product/Location → Enter Counted Qty → Validate → Delta Applied | Reason Logged
```

### 8. Move History (Ledger)
Every validated inventory movement is permanently recorded — fully traceable and audit-ready.

---

## 🏗️ Inventory Flow Example

```
1. Receive goods           → +100 kg Steel (stock increases)
2. Internal transfer       → Main Store → Production Rack (total unchanged)
3. Deliver to customer     → −20 kg Steel (stock decreases)
4. Adjust damaged stock    → −3 kg Steel (adjustment logged with reason)
```

All four events are captured in the stock ledger with timestamps, actors, and quantities.

---

## ⚙️ Tech Stack

### Frontend — `client/`

| Technology | Purpose |
|---|---|
| React 18 + Vite 6 | UI framework and build tooling |
| React Router v6 | Client-side routing |
| TanStack Query v5 | Server state management and caching |
| React Hook Form v7 | Form handling and validation |
| Zustand v5 | Global client state (auth, UI) |
| Axios | HTTP client |
| Tailwind CSS v3 | Utility-first styling |
| Headless UI + Heroicons | Accessible components and icons |
| date-fns | Date formatting and manipulation |
| react-hot-toast | Notification toasts |

### Backend — `server/`

| Technology | Purpose |
|---|---|
| Node.js 18+ | Runtime |
| Express 5 | Web framework |
| MongoDB + Mongoose 9 | Database and ODM |
| JSON Web Token | Access & refresh token auth |
| bcryptjs | Password hashing |
| nodemailer | OTP email delivery |
| express-validator | Request validation |
| express-rate-limit | Auth route rate limiting |
| Helmet | HTTP security headers |
| CORS | Cross-origin request handling |
| cookie-parser | Cookie management |
| dotenv | Environment variable loading |
| nodemon | Dev auto-reload |

---

## 📁 Repository Structure

```
CoreInventory/
├── client/                         # React + Vite frontend
│   ├── src/
│   │   ├── api/                    # Axios instances and endpoint helpers
│   │   ├── components/             # Reusable UI components
│   │   ├── constants/              # App-wide enums and static values
│   │   ├── hooks/                  # Custom React hooks
│   │   ├── layouts/                # Route layout wrappers
│   │   ├── pages/                  # Page components per route
│   │   │   ├── auth/               # Login, signup, reset-password
│   │   │   ├── dashboard/
│   │   │   ├── products/
│   │   │   ├── receipts/
│   │   │   ├── deliveries/
│   │   │   ├── transfers/
│   │   │   ├── adjustments/
│   │   │   ├── moves/
│   │   │   └── settings/
│   │   ├── store/                  # Zustand state stores
│   │   ├── utils/                  # Helper functions
│   │   ├── App.jsx                 # Route definitions
│   │   └── main.jsx                # Entry point
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── server/                         # Express + MongoDB backend
│   ├── config/                     # DB connection and app config
│   ├── controllers/                # Route handler logic
│   ├── middleware/                 # Auth, error, role guards
│   ├── models/                     # Mongoose schemas
│   │   ├── User.js
│   │   ├── Product.js
│   │   ├── ProductCategory.js
│   │   ├── Warehouse.js
│   │   ├── Location.js
│   │   ├── StockPicking.js         # Receipts, Deliveries, Transfers
│   │   ├── StockMove.js
│   │   ├── StockMoveLine.js
│   │   ├── StockQuant.js           # On-hand quantities
│   │   ├── StockAdjustment.js
│   │   ├── ReorderRule.js
│   │   └── Otp.js
│   ├── routes/                     # Express route registrations
│   ├── utils/                      # Shared utilities (email, tokens, etc.)
│   ├── server.js                   # Entry point
│   └── package.json
│
├── CoreInventory_Frontend_Guide.txt
├── CoreInventory_SystemDesign.txt
├── CoreInventory_Mockups.pdf
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+
- **npm** 9+
- **MongoDB** (local instance or MongoDB Atlas)

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/CoreInventory.git
cd CoreInventory
```

### 2. Set Up the Backend

```bash
cd server
npm install
```

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Start the development server:

```bash
npm run dev
```

The API will be available at `http://localhost:5000`.

### 3. Set Up the Frontend

```bash
cd ../client
npm install
```

Create the frontend environment file:

```bash
# client/.env
VITE_API_BASE_URL=http://localhost:5000/api
```

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## 🔐 Environment Variables

### `server/.env`

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGO_URI=mongodb://localhost:27017/coreinventory

# Authentication
JWT_SECRET=your_jwt_secret_key_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_here
JWT_EXPIRE=1h
JWT_REFRESH_EXPIRE=7d

# Email (for OTP delivery)
GMAIL_ID=your_gmail@gmail.com
GMAIL_PASSWORD=your_gmail_app_password
```

> **Tip:** Use a [Gmail App Password](https://myaccount.google.com/apppasswords) instead of your account password for `GMAIL_PASSWORD`.

### `client/.env`

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

---

## 📡 API Reference

**Base path:** `/api`

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/register` | Register a new user |
| `POST` | `/auth/login` | Login and receive tokens |
| `POST` | `/auth/logout` | Invalidate session |
| `POST` | `/auth/send-otp` | Send OTP to email |
| `POST` | `/auth/verify-otp` | Verify OTP code |
| `POST` | `/auth/reset-password` | Reset password after OTP |
| `GET`  | `/auth/me` | Get authenticated user profile |

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/dashboard/kpis` | Summary KPI counts |
| `GET` | `/dashboard/operations-summary` | Recent operations overview |
| `GET` | `/dashboard/alerts` | Low-stock and reorder alerts |

### Products

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/products` | List all products |
| `POST` | `/products` | Create a product |
| `GET` | `/products/:id` | Get a product by ID |
| `PUT` | `/products/:id` | Update a product |
| `DELETE` | `/products/:id` | Delete a product |
| `GET` | `/products/:id/stock` | Get stock levels for a product |
| `GET` | `/products/categories` | List categories |
| `POST` | `/products/categories` | Create a category |
| `PUT` | `/products/categories/:id` | Update a category |
| `GET` | `/products/reorder-rules` | List reorder rules |
| `POST` | `/products/reorder-rules` | Create a reorder rule |
| `PUT` | `/products/reorder-rules/:id` | Update a reorder rule |
| `DELETE` | `/products/reorder-rules/:id` | Delete a reorder rule |

### Receipts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/receipts` | List all receipts |
| `POST` | `/receipts` | Create a receipt |
| `GET` | `/receipts/:id` | Get a receipt by ID |
| `PUT` | `/receipts/:id` | Update a receipt |
| `POST` | `/receipts/:id/validate` | Validate and apply stock |
| `POST` | `/receipts/:id/cancel` | Cancel a receipt |
| `POST` | `/receipts/:id/return` | Create a return |

### Deliveries

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/deliveries` | List all deliveries |
| `POST` | `/deliveries` | Create a delivery |
| `GET` | `/deliveries/:id` | Get a delivery by ID |
| `PUT` | `/deliveries/:id` | Update a delivery |
| `POST` | `/deliveries/:id/validate` | Validate and deduct stock |
| `POST` | `/deliveries/:id/cancel` | Cancel a delivery |
| `POST` | `/deliveries/:id/return` | Create a return |

### Transfers

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/transfers` | List all transfers |
| `POST` | `/transfers` | Create a transfer |
| `GET` | `/transfers/:id` | Get a transfer by ID |
| `PUT` | `/transfers/:id` | Update a transfer |
| `POST` | `/transfers/:id/validate` | Validate and move stock |
| `POST` | `/transfers/:id/cancel` | Cancel a transfer |

### Adjustments

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/adjustments` | List all adjustments |
| `POST` | `/adjustments` | Create an adjustment |
| `GET` | `/adjustments/:id` | Get an adjustment by ID |
| `POST` | `/adjustments/:id/validate` | Validate and apply delta |
| `POST` | `/adjustments/:id/cancel` | Cancel an adjustment |

### Move History

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/moves` | List all stock movements |
| `GET` | `/moves/:id` | Get a movement by ID |

### Warehouses & Locations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/warehouses` | List warehouses |
| `POST` | `/warehouses` | Create a warehouse |
| `GET` | `/warehouses/:id` | Get a warehouse |
| `PUT` | `/warehouses/:id` | Update a warehouse |
| `DELETE` | `/warehouses/:id` | Delete a warehouse |
| `GET` | `/locations` | List locations |
| `POST` | `/locations` | Create a location |
| `GET` | `/locations/:id` | Get a location |
| `PUT` | `/locations/:id` | Update a location |
| `DELETE` | `/locations/:id` | Delete a location |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Server health check |

---

## 🗺️ Frontend Routes

### Public

| Route | Description |
|-------|-------------|
| `/login` | User login |
| `/signup` | User registration |
| `/reset-password` | OTP-based password reset |

### Protected

| Route | Description | Roles |
|-------|-------------|-------|
| `/dashboard` | KPI overview and alerts | All |
| `/products` | Product catalog | Manager |
| `/products/new` | Create product | Manager |
| `/products/:id/edit` | Edit product | Manager |
| `/products/categories` | Manage categories | Manager |
| `/products/reorder-rules` | Reorder configuration | Manager |
| `/operations/receipts` | Receipt list | Manager |
| `/operations/receipts/new` | Create receipt | Manager |
| `/operations/receipts/:id` | Receipt detail | Manager |
| `/operations/deliveries` | Delivery list | Manager |
| `/operations/deliveries/new` | Create delivery | Manager |
| `/operations/deliveries/:id` | Delivery detail | Manager |
| `/operations/transfers` | Transfer list | All |
| `/operations/transfers/new` | Create transfer | All |
| `/operations/transfers/:id` | Transfer detail | All |
| `/operations/adjustments` | Adjustment list | All |
| `/operations/adjustments/new` | Create adjustment | All |
| `/operations/adjustments/:id` | Adjustment detail | All |
| `/operations/moves` | Stock move ledger | All |
| `/settings/warehouses` | Warehouse management | Manager |
| `/settings/locations` | Location management | Manager |

---

## 🗄️ Data Models

| Model | Description |
|-------|-------------|
| `User` | User accounts with role and hashed password |
| `Product` | Product catalog with SKU, UoM, and category |
| `ProductCategory` | Hierarchical product categories |
| `Warehouse` | Physical warehouse definitions |
| `Location` | Sub-locations within warehouses |
| `StockPicking` | Receipts, deliveries, and transfers (polymorphic) |
| `StockMove` | Individual product movements within a picking |
| `StockMoveLine` | Detailed lines per move (lot/serial support ready) |
| `StockQuant` | On-hand quantity per product per location |
| `StockAdjustment` | Physical inventory count reconciliation records |
| `ReorderRule` | Automated replenishment rules per product/location |
| `Otp` | Time-limited OTP tokens for password reset |

---

## 🔒 Security

| Measure | Implementation |
|---------|----------------|
| Password storage | `bcryptjs` hashing |
| API authentication | JWT access tokens (1h) + refresh tokens (7d) |
| Cookie handling | `httpOnly` cookies via `cookie-parser` |
| Rate limiting | `express-rate-limit` on auth routes |
| Input validation | `express-validator` on all write endpoints |
| HTTP headers | `helmet` middleware |
| CORS | Configured allowed origins |
| Role enforcement | Middleware-level route guards |

---

## 📦 Scripts

### Client (`client/`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build locally |

### Server (`server/`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with nodemon (auto-reload) |
| `npm start` | Start with Node.js (production) |

---

## 🗺️ Roadmap

Currently implemented:

- [x] JWT authentication with OTP password reset
- [x] Product, category, and reorder rule management
- [x] Receipts, deliveries, transfers, and adjustments with validation
- [x] Warehouse and location configuration
- [x] Dashboard KPIs, summaries, and alerts
- [x] Immutable stock move ledger

Planned improvements:

- [ ] Automated unit and integration tests
- [ ] CI/CD pipeline with quality gates
- [ ] OpenAPI / Swagger documentation
- [ ] Multi-tenant support and granular permissions
- [ ] Background jobs for reorder notifications and automated replenishment

---

## 📚 Documentation

Additional documentation is included in the repository root:

| File | Description |
|------|-------------|
| [`CoreInventory_Frontend_Guide.txt`](./CoreInventory_Frontend_Guide.txt) | Component architecture, page structure, and UI conventions |
| [`CoreInventory_SystemDesign.txt`](./CoreInventory_SystemDesign.txt) | Data model design, API contracts, and system architecture decisions |
| [`CoreInventory_Mockups.pdf`](./CoreInventory_Mockups.pdf) | UI mockups and workflow diagrams |

---

## 📄 License

This project is licensed under the **ISC License**.

---

<div align="center">
  <sub>Built with Node.js · Express · MongoDB · React · Vite · Tailwind CSS</sub>
</div>
