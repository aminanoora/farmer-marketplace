# Krishi Market API Documentation

Base URL: `http://localhost:5000/api`

## Authentication

All protected endpoints require a Bearer token:
```
Authorization: Bearer <jwt_token>
```

## Endpoints

### Auth

#### Register
```
POST /auth/register
Body: { name, email, password, role: "farmer" | "consumer", phone?, farmName? }
```

#### Login
```
POST /auth/login
Body: { email, password }
```

### Products

#### List Products
```
GET /products?category=id&farmer=id&isOrganic=true&minPrice=10&maxPrice=100&search=spinach&page=1&limit=20
```

#### Get Product
```
GET /products/:id
```

### Farmers (Public)
```
GET /farmers          # List verified farmers
GET /farmers/:id      # Farmer profile with products
```

### Farmer (Protected)
```
GET   /farmers/me/profile
PUT   /farmers/me
GET   /farmers/me/products
POST  /farmers/me/products
PUT   /farmers/me/products/:id
DELETE/farmers/me/products/:id
GET   /farmers/me/orders
PATCH /farmers/me/orders/:id
GET   /farmers/me/earnings
```

### Orders (Protected)
```
POST /orders
Body: { items: [{ productId, quantity }], deliverySlot?, deliveryAddress, notes? }

GET /orders          # Consumer's orders
GET /orders/:id      # Single order (consumer/farmer/admin)
```

### Reviews
```
GET  /reviews?farmer=id&product=id
POST /reviews
Body: { product?, farmer, rating, comment? }
```

### Admin (Protected - Admin Only)
```
GET    /admin/dashboard
GET    /admin/farmers?status=pending
PATCH  /admin/farmers/:id/approve
PATCH  /admin/farmers/:id/reject
POST   /admin/categories
GET    /admin/orders
GET    /admin/analytics
```

## Response Format

### Success
```json
{ "success": true, ...data }
```

### Error
```json
{ "success": false, "message": "Error description" }
```

### Pagination
```json
{ "products": [...], "pagination": { "page": 1, "limit": 20, "total": 50, "pages": 3 } }
```
