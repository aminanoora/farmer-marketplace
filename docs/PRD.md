# Krishi Market — PRD

> Farmer-to-Consumer Agri Marketplace
> Version 1.0 | 19 July 2026

## Overview

Krishi Market is a web-based platform connecting local farmers directly with end consumers, removing intermediaries from the agricultural supply chain.

## User Roles

### Farmer
- Register and verify identity
- Create farmer profile (location, crops, farming method)
- List products (vegetables, fruits, dairy, grains)
- Manage orders and update status
- View sales and earnings

### Consumer
- Browse products by category, location, organic status
- View farmer profiles and practices
- Place orders with delivery slot selection
- Track order history
- Rate and review

### Admin
- Approve/reject farmer registrations
- Manage categories
- Monitor orders and disputes
- Platform analytics

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend | Node.js, Express.js, REST APIs |
| Database | MongoDB (Mongoose ODM) |
| Auth | JWT (JSON Web Tokens) |

## API Endpoints

### Auth
- `POST /api/auth/register` — Register (farmer/consumer)
- `POST /api/auth/login` — Login
- `GET /api/auth/me` — Get current user

### Products (Public)
- `GET /api/products` — List with filters
- `GET /api/products/:id` — Single product

### Farmers
- `GET /api/farmers` — List verified farmers
- `GET /api/farmers/:id` — Farmer profile + products
- `GET /api/farmers/me/profile` — Own profile
- `PUT /api/farmers/me` — Update profile
- `GET/POST /api/farmers/me/products` — Manage products
- `GET /api/farmers/me/orders` — Incoming orders
- `PATCH /api/farmers/me/orders/:id` — Update order status
- `GET /api/farmers/me/earnings` — Earnings summary

### Orders
- `POST /api/orders` — Place order
- `GET /api/orders` — Consumer's orders

### Admin
- `GET /api/admin/dashboard` — Dashboard stats
- `GET /api/admin/farmers` — List farmers
- `PATCH /api/admin/farmers/:id/approve` — Approve
- `PATCH /api/admin/farmers/:id/reject` — Reject
- `POST /api/admin/categories` — Create category
- `GET /api/admin/analytics` — Platform analytics

## Database Models

### User
- name, email, password (hashed), role, phone
- Farmer extras: farmName, farmLocation, cropTypes, farmingMethod, verificationStatus

### Product
- farmer (ref), name, category (ref), price, unit, quantity, images, harvestDate, isOrganic

### Order
- consumer (ref), farmer (ref), items[], totalAmount, status, deliverySlot, deliveryAddress

### Review
- consumer (ref), product (ref), farmer (ref), rating (1-5), comment

### Category
- name, slug, description, icon
