# 🌾 Krishi Market — Farmer-to-Consumer Agri Marketplace

Connecting local farmers directly with consumers — removing intermediaries, improving farmer income, and delivering fresh, traceable produce.

## 🚀 Tech Stack

| Layer        | Technology                     |
|-------------|--------------------------------|
| Frontend    | Next.js 14, TypeScript, Tailwind CSS |
| Backend     | Node.js, Express.js, REST APIs |
| Database    | MongoDB (Mongoose)             |
| Auth        | JWT (JSON Web Tokens)          |
| Deployment  | Vercel (client) + Railway / AWS (server) |

## 📁 Project Structure

```
krishi-market/
├── client/                 # Next.js frontend
│   ├── public/
│   └── src/
│       ├── app/            # App Router pages
│       │   ├── auth/       # Login / Register
│       │   ├── farmer/     # Farmer dashboard
│       │   ├── consumer/   # Consumer browsing & orders
│       │   └── admin/      # Admin panel
│       ├── components/     # Reusable UI components
│       ├── lib/            # Utilities & API client
│       └── styles/         # Global styles
├── server/                 # Express.js backend
│   └── src/
│       ├── config/         # DB & env configuration
│       ├── controllers/    # Route handlers
│       ├── middleware/     # Auth, error, validation
│       ├── models/         # Mongoose schemas
│       ├── routes/         # API route definitions
│       ├── validators/     # Request validation
│       ├── utils/          # Helpers & response wrappers
│       └── types/          # TypeScript type definitions
├── shared/                 # Shared types & utilities
├── docs/                   # Documentation
└── scripts/                # Utility scripts
```

## 👥 User Roles

| Role      | Capabilities |
|-----------|-------------|
| **Farmer**  | Register, list products, manage orders, view earnings |
| **Consumer**| Browse, place orders, track history, rate & review |
| **Admin**   | Approve farmers, manage categories, monitor platform |

## 🛠 Getting Started

```bash
# 1. Clone the repository
git clone https://github.com/your-org/krishi-market.git
cd krishi-market

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret

# 4. Start both client & server in dev mode
npm run dev
```

## 📄 License

MIT — Built for Unified Mentor
