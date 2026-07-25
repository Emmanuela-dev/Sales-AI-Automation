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


