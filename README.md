# order-service

Manages the full order lifecycle — from cart management through checkout, stock coordination (via RabbitMQ), to completed/cancelled orders.

**Tech:** NestJS · TypeScript · PostgreSQL · TypeORM · RabbitMQ

**Internal port:** `3003`

---

## Order Lifecycle

```
CART
  │
  │ POST /orders/cart/checkout
  ▼
PENDING ──── order.created ────▶ RabbitMQ ────▶ product-service (reserve stock)
  │                                                     │
  │                               ┌────────────────────┤
  │                               ▼                    ▼
  │                        stock.reserved         stock.failed
  │                               │                    │
  ▼                               ▼                    ▼
PENDING ───── awaiting.payment ──▶ payment-service  CANCELLED
  │
  │ (Midtrans webhook)
  ▼
COMPLETED
```

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/orders/cart` | JWT | Get current user's active cart |
| POST | `/orders/cart/items` | JWT | Add item to cart |
| PATCH | `/orders/cart/items/:skuId` | JWT | Update item quantity in cart |
| DELETE | `/orders/cart/items/:skuId` | JWT | Remove item from cart |
| DELETE | `/orders/cart` | JWT | Clear entire cart |
| POST | `/orders/cart/checkout` | JWT (Gateway) | Checkout cart — locks prices, begins stock reservation |
| GET | `/orders/user/me` | JWT | Get all orders for current user |
| GET | `/orders/:id` | JWT | Get order detail with line items |
| GET | `/orders` | JWT (Admin) | Get all orders |

> All endpoints are exposed via the API gateway at `/api/order/*`

---

## RabbitMQ Events

| Direction | Event | Trigger | Action |
|---|---|---|---|
| Publishes | `order.created` | Checkout completed | Sends order items to product-service for stock reservation |
| Publishes | `order.awaiting.payment` | Stock reserved | Sends order details to payment-service to create QRIS charge |
| Consumes | `order.stock.reserved` | Product-service confirms stock | Updates order status → PENDING |
| Consumes | `order.stock.failed` | Product-service reports shortage | Updates order status → CANCELLED |

---

## System Flow

### POST /orders/cart/items — Add to Cart

```
Client (User JWT)
  │
  ▼
[ order-service ]
  │
  ├── Find existing CART order for user (or create one)
  ├── Check if SKU already in cart
  │     ├── Yes → increment quantity
  │     └── No  → add new order item
  └── Return updated cart
```

### POST /orders/cart/checkout — Checkout

```
[ API Gateway ] (validates SKUs + locks prices first)
  │
  ▼
[ order-service ] POST /orders/cart/checkout
  │
  ├── Receive cart items with locked prices from gateway
  ├── Calculate totalAmount
  ├── Update order status: CART → PENDING
  ├── Save locked prices on each order item
  └── Publish → order.created (order ID + items + quantities)
```

### Consume order.stock.reserved

```
[ RabbitMQ ] ──── order.stock.reserved ────▶ [ order-service ]
                                                    │
                                                    ├── Update order status → PENDING
                                                    └── Publish → order.awaiting.payment
```

### Consume order.stock.failed

```
[ RabbitMQ ] ──── order.stock.failed ────▶ [ order-service ]
                                                  │
                                                  └── Update order status → CANCELLED
```

---

## Project Structure

```
order-service/
└── src/
    ├── orders/
    │   ├── entities/order.entity.ts      # Order (userId, status, totalAmount)
    │   ├── orders.controller.ts          # Cart and order endpoints
    │   ├── orders.service.ts             # Cart management + checkout logic
    │   ├── repositories/orders.repository.ts
    │   └── events/                       # Event payload types
    │       ├── order-created.event.ts
    │       ├── order-awaiting-payment.event.ts
    │       ├── order-stock-reserved.event.ts
    │       └── order-stock-failed.event.ts
    ├── order-items/
    │   ├── entities/order-item.entity.ts # OrderItem (skuId, quantity, price)
    │   ├── order-items.service.ts
    │   └── repositories/
    └── rabbitmq/
        ├── rabbitmq.consumer.ts          # Consumes stock.reserved / stock.failed
        └── rabbitmq.service.ts           # Publishes order.created / awaiting.payment
```

---

## Environment Variables

```env
PORT=3003

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=postgres
DB_NAME=microserv_db

RABBITMQ_URL=amqp://guest:guest@localhost:5672

JWT_SECRET=your_jwt_secret
```

---

## Running Locally

```bash
npm install
npm run start:dev
```

Service runs on `http://localhost:3003`.

## Example Requests

### Get Cart
```bash
curl http://localhost:3003/orders/cart \
  -H "x-user-id: <user_uuid>"
```

### Add to Cart
```bash
curl -X POST http://localhost:3003/orders/cart/items \
  -H "Content-Type: application/json" \
  -H "x-user-id: <user_uuid>" \
  -d '{"skuId": "<sku_uuid>", "quantity": 2}'
```

### Get My Orders
```bash
curl http://localhost:3003/orders/user/me \
  -H "x-user-id: <user_uuid>"
```

> Note: In local dev, user identity is passed via `x-user-id` header (set by the gateway after JWT validation).

## Docker

```bash
docker build -t order-service .
docker run --env-file .env -p 3003:3003 order-service
```

## Part of

[E-Commerce Microservices Platform](../README.md)
