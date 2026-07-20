# 🚀 SaaSify — Multi-Tenant SaaS Platform

> A production-ready workspace management system demonstrating multi-tenancy,
> role-based access control, real-time collaboration, and modern web architecture.

## 🔗 Live Demo
**[https://saasify-yourname.vercel.app](https://saasify-yourname.vercel.app)**
> 🟡 Demo credentials: `demo@acme.com` / `demo1234`

## 📸 Screenshots
<!-- Add screenshots after deployment -->

## ✨ Features
- 🔐 **Authentication** — Secure registration, login, session management
- 🏢 **Multi-Tenancy** — Isolated workspaces with organization switching
- 👥 **RBAC** — Role-based access control (Owner, Admin, Member)
- 📋 **Project Management** — Full CRUD with archiving and filtering
- ✅ **Task Management** — Priorities, assignees, due dates, Kanban board
- 🎯 **Kanban Board** — Drag-and-drop task management
- 💬 **Comments** — Task-level discussion threads
- 📊 **Dashboard** — Stats, charts, activity feed
- 🔍 **Global Search** — Spotlight-style search (⌘K)
- 📡 **Real-Time** — Live updates via Socket.IO
- 📝 **Activity Logging** — Complete audit trail
- 🌙 **Dark Mode** — System-aware theme switching
- 📱 **Responsive** — Mobile-first design
- ✉️ **Invitations** — Token-based team invitations

## 🛠️ Tech Stack
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Database | PostgreSQL (Supabase) |
| ORM | Prisma |
| Auth | NextAuth.js |
| Real-Time | Socket.IO |
| State | Zustand |
| Charts | Recharts |
| Deployment | Vercel |

## 📁 Project Structure
```
src/
├── app/
│   ├── api/           # API routes
│   │   ├── auth/      # Authentication endpoints
│   │   ├── organizations/  # Org CRUD
│   │   ├── projects/       # Project CRUD
│   │   ├── tasks/          # Task CRUD
│   │   ├── teams/          # Team CRUD
│   │   └── invitations/    # Invitation system
│   └── page.tsx       # Single-page app entry
├── components/
│   ├── auth/          # Login, register
│   ├── layout/        # Sidebar, topbar, footer
│   ├── dashboard/     # Dashboard components
│   ├── projects/      # Project components
│   ├── tasks/         # Task + Kanban components
│   ├── teams/         # Team components
│   └── ui/            # shadcn/ui components
├── lib/
│   ├── db.ts          # Prisma client
│   ├── auth.ts        # NextAuth config
│   ├── permissions.ts # RBAC logic
│   ├── activity.ts    # Activity logging
│   └── socket.ts      # Socket.IO client
├── stores/
│   └── app-store.ts   # Zustand store
└── types/
    └── index.ts       # TypeScript types
```

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- Bun
- A Supabase account

### Setup
```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/saasify.git
cd saasify

# Install dependencies
bun install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Push database schema
bunx prisma db push

# (Optional) Seed demo data
bunx prisma db seed

# Start development
bun run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 🎓 What I Learned
- Designing multi-tenant database schemas with proper isolation
- Implementing RBAC from scratch with permission matrices
- Building real-time features with Socket.IO
- Drag-and-drop Kanban boards with @dnd-kit
- PostgreSQL schema design with Prisma ORM
- Production deployment with Vercel + Supabase
- Building responsive SPAs within a single Next.js route

## 📄 License
MIT