# ProspectAI — AI Sales Intelligence Platform

> An AI employee that finds, researches, qualifies, and helps close clients automatically.

## 🚀 What Is This?

**ProspectAI** is a complete AI-powered sales automation platform that:

- **Discovers** businesses using natural language search ("Hotels in Nairobi")
- **Analyzes** websites automatically (speed, mobile-friendliness, SEO issues)
- **Researches** companies using AI (budget estimates, likely needs, pain points)
- **Scores** leads from 0–100 based on opportunity potential
- **Generates** personalized outreach (email, WhatsApp, LinkedIn, call scripts)
- **Drafts** project proposals with timelines, milestones, and pricing
- **Tracks** every lead through a full CRM pipeline
- **Follows up** automatically when leads go cold


## 🏁 Quick Start

**Prerequisites:** Node.js 20+, Docker Desktop, a Supabase project, an OpenAI API key.

### 1. Install

```bash
npm run setup      # installs dependencies + the Playwright chromium browser
```

### 2. Configure

Copy the examples and fill in real values:

```bash
cp apps/backend/.env.example  apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env.local
```

| Variable | Where to get it | Required? |
| --- | --- | --- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API | Yes |
| `DATABASE_URL` | Supabase → Project Settings → Database → Connection string (URI) | Yes, for migrations |
| `JWT_SECRET` | Any random 32+ character string (`openssl rand -hex 32`) | Yes |
| `OPENAI_API_KEY` | platform.openai.com/api-keys | Yes, for all AI features |
| `GOOGLE_PLACES_API_KEY` | Google Cloud Console → Places API | Optional — without it, search only queries your existing database |

The frontend needs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (same project) and `NEXT_PUBLIC_API_URL`.

### 3. Start infrastructure and create the schema

```bash
docker-compose up -d redis
npm run migrate
```

### 4. Verify the setup

```bash
npm run doctor
```

Checks Supabase, Redis, Playwright, OpenAI and Google Places, and tells you exactly what to fix for anything that fails. Get this green before continuing.

### 5. Create your login user

There is no sign-up page — only sign-in. Create your account in the Supabase
dashboard under **Authentication → Users → Add user** (tick *Auto Confirm User*).

### 6. Run

```bash
npm run dev
```

- Frontend — http://localhost:3000
- Backend — http://localhost:4000
- API docs — http://localhost:4000/docs

In development the background workers run inside the API process. In production
run them separately:

```bash
npm run build
npm start --workspace=apps/backend          # API
npm run start:workers --workspace=apps/backend   # queues + scheduler
```

### Authentication

Every `/api/v1` route requires the Supabase access token as
`Authorization: Bearer <token>`. The frontend attaches it automatically. To call
the API by hand (curl, Swagger UI) during local development, set
`DEV_ALLOW_ANONYMOUS=true` in `apps/backend/.env` — it is ignored when
`NODE_ENV=production`.

---

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER (Browser)                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   FRONTEND (Next.js 14)                         │
│  - Auth (Supabase)                                              │
│  - Pages: Dashboard, Search, Leads, Pipeline, Analytics         │
│  - React Query (data fetching)                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTP REST API
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (Fastify)                           │
│  Routes:                                                        │
│   /search         → Discover businesses                         │
│   /leads          → Manage leads                                │
│   /analysis       → Website intelligence                        │
│   /outreach       → AI-generated messages                       │
│   /proposals      → AI-generated proposals                      │
│   /crm            → Activities, follow-ups, pipeline            │
│   /analytics      → Stats & metrics                             │
└─────────────────────────────────────────────────────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────────┐  ┌──────────────┐
│  Supabase    │  │  OpenAI API      │  │  BullMQ      │
│  PostgreSQL  │  │  (GPT-4)         │  │  + Redis     │
│              │  │                  │  │              │
│  - businesses│  │  - Lead scoring  │  │  - Website   │
│  - leads     │  │  - Research      │  │    analysis  │
│  - analyses  │  │  - Outreach gen  │  │  - AI jobs   │
│  - proposals │  │  - Proposal gen  │  │  - Follow-up │
│  - crm       │  │                  │  │    scheduler │
└──────────────┘  └──────────────────┘  └──────────────┘
```

---

## 🌟 Key Features Implemented

### ✅ Milestone 1: Business Discovery
- [x] Natural language search
- [x] Google Places API integration
- [x] Business database with deduplication
- [x] Industry categorization

### ✅ Milestone 2: Website Intelligence
- [x] Automated website analysis (Playwright)
- [x] Digital presence scoring (0–100)
- [x] Issue detection (HTTPS, mobile, SEO, speed)
- [x] Tech stack detection
- [x] Actionable recommendations

### ✅ Milestone 3: AI Sales Assistant
- [x] AI company research & summaries
- [x] Opportunity scoring (0–100)
- [x] Personalized outreach generation (4 channels)
- [x] AI proposal drafting with milestones & pricing

### ✅ Milestone 4: Sales Automation
- [x] Full CRM with activity tracking
- [x] Pipeline kanban board
- [x] Automated follow-up reminders
- [x] Analytics dashboard with conversion metrics
- [x] Background job processing (BullMQ)

---

## 📝 Next Steps (Optional Enhancements)

- [ ] Email sending integration (SendGrid, AWS SES)
- [ ] WhatsApp Business API integration
- [ ] LinkedIn Sales Navigator scraping
- [ ] Custom email templates
- [ ] Team collaboration (assign leads, shared notes)
- [ ] Mobile app (React Native)
- [ ] Zapier/Make.com integrations
- [ ] Advanced analytics (cohort analysis, forecasting)


