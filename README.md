# WMS-Plus

A comprehensive **Warehouse Management System** designed to streamline order processing, inventory control, sales operations, and delivery workflows for businesses that sell products to retail stores.

---

## Project Goals

- **End-to-end order lifecycle management** — from sales order creation to delivery and payment closure
- **Role-based access control** — each user sees only the data and actions relevant to their role
- **Price transparency control** — pricing and cost visibility restricted to authorized roles only
- **Real-time inventory sync** — live stock levels visible to sales and packing teams
- **Audit trail** — track order changes, packing quantities, and delivery proof

---

## User Roles

### Warehouse Users (Inside)

| Role | Responsibilities |
|------|------------------|
| **Accounts** | Verify payments, close orders, manage financial records, vendor/customer payments, petty cash, full financial tracking |
| **Order Manager** | Review orders, edit/delete products, assign orders to packers. *Cannot see prices or costs.* |
| **Inventory Manager** | Create items, set min/suggested retail/wholesale prices, see product cost, approve POs and stock, manage products, vendors |
| **Inventory Receiver** | Receive stock, submit POs by vendor/invoice, enter items. *Cannot see product cost.* |
| **Sales Manager** | Full visibility: sales data, profitability, reports, customers, credits, payments, driver routes/logs |
| **Order Scanner/Packer** | Pack orders assigned by Order Manager. Prints sales order slips for pickers, scans barcodes, enters box count and packed quantities. *Cannot see prices.* |
| **Pickers** | Pick full orders from warehouse and deliver to scanner/packer |

*More roles to be added.*

### Outside Users

| Role | Responsibilities |
|------|------------------|
| **Sales Person** | Visit stores, take orders, enter customer name, select products (prices shown at their end) |
| **Driver** | Deliver orders assigned by Sales Manager, update delivery status, add payment details and proof of delivery (image/signature) |

---

## Order Life Cycle

| Status | Description |
|--------|-------------|
| **1. New** | Order created by Sales Person |
| **2. Processed** | Order Manager assigns order to Packer/Scanner |
| **3. Packed** | Scanner has packed the order and entered quantities |
| **4. Ready to Ship** | Sales Manager assigns order to Driver |
| **5. Shipped** | Driver loads order in van |
| **6. Delivered / Undelivered** | Driver updates status after reaching customer |
| **7. Closed** | Accounts verifies payment and closes the order |

---

## End-to-End Workflow

### 1. Sales Order Creation
- Sales Person visits store → enters customer name → selects products
- Prices displayed at Sales Person's end
- Order appears on Order Manager's screen

### 2. Order Management
- Order Manager can edit or delete products (no price/cost visibility)
- Assigns order to Scanner/Packer

### 3. Picking & Packing
- Scanner sees: Sales Person name, order number, customer number, customer name, address, shipping type
- Prints **Sales Order** (packing slip) for Pickers
- Pickers bring full order from warehouse to Scanner
- Scanner scans product barcodes (pre-saved by Inventory Manager)
- Enters **total boxes** and **actual packed quantity** per item
- Example: Sales ordered Colgate 12oz 6pc → only 2pc in stock → Scanner scans twice → System records 2pc
- **Once packed:** Order Manager and Scanner lose edit access. Only Sales Manager can modify from this point.

### 4. Invoice & Quantity Lock
- Invoice prints only for packed quantity (e.g., 2pc, not 6pc)
- Sales Person's account updated with actual shipped quantity
- System remembers custom prices per customer (e.g., suggested $20 → sales used $16 → next time shows $16)

### 5. Shipping & Delivery
- Sales Manager assigns order to Driver → status: **Ready to Ship**
- Driver finds order, loads van → status: **Shipped**
- Driver reaches customer → updates **Delivered** or **Undelivered**
- On successful delivery: Driver adds payment details and proof (image/signature)

### 6. Closure
- Accounts verifies payment and closes the order

---

## Pricing & Permissions

### Who Can See Prices & Costs?

| Role | Price/Cost Visibility |
|------|------------------------|
| Sales Manager | ✅ Full visibility |
| Accounts | ✅ Full visibility |
| Inventory Manager | ✅ Product cost visible |
| Inventory Receiver | ❌ No cost visibility |
| Order Manager | ❌ No price/cost visibility |
| Scanner/Packer | ❌ No price visibility |
| Driver | Physical copy of invoices only |
| Sales Person | ✅ Prices at order entry |

### Inventory Manager Controls
- Set **min price** (e.g., min $10) — Sales Person cannot submit below this
- Set **suggested retail price** (e.g., $20) — first click shows this
- System remembers last used price per customer (e.g., $16) for future orders

---

## Inventory & Receiving

- **Inventory Receiver:** Creates PO by vendor name, invoice number, enters items. Submits to Inventory Manager. No cost visibility.
- **Inventory Manager:** Approves PO, reviews stock, updates live inventory.
- **Live stock** displayed to Sales Person and Scanner for order entry and packing.

---

## Inventory Manager — Detailed Capabilities

| Module | Capabilities |
|--------|--------------|
| **Dashboard** | Display all data matrix |
| **Update Stock** | Manage and adjust inventory levels |
| **Products** | Create new product list, update existing products, add/remove product barcodes, print item box codes, view all product-related data |
| **Purchase Order** | Create, review, and approve purchase orders |
| **Vendor** | Create, update, and delete vendors; track vendor credit, price, cost, and open balance |

---

## Accounts — Detailed Capabilities

- **Full financial tracking** — Keep track of everything across the system
- **Vendor payments** — Process and record payments to vendors
- **Customer payments** — Process and record payments from customers
- **Current petty cash** — Monitor and manage petty cash balance
- **Order closure** — Verify payments and close delivered orders
- *More capabilities to be added*

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Node.js, Express.js |
| **Frontend** | HTML, CSS, JavaScript, React, Bootstrap |
| **Stack** | MERN (MongoDB, Express, React, Node.js) |

---

## Getting Started (Docker)

**Prerequisites:** Docker and Docker Compose

```bash
# Start all services (client, server, MongoDB) with live reload
docker compose up --build
```

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000
- **MongoDB:** localhost:27017

Code changes in `client/` and `server/` will hot-reload automatically.

---

## License

Unlicense — See [LICENSE](LICENSE) for details.
