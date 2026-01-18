# Feedback Market

Feedback Market is a **prototype tool for aggregating and analyzing product feedback**. It leverages Cloudflare Workers and other developer platform products to help PMs understand user sentiment, urgency, and trends in feedback. Teams can stake tokens on claims and track how feedback evolves over time.

---

## Demo

The deployed Worker can be accessed here:  
[https://feedback-market.feedback-market-sahithi.workers.dev](https://feedback-market.feedback-market-sahithi.workers.dev)

---

## Features

- **Dashboard** (React frontend)  
  - Claims ranked by signal weight  
  - Trend indicators (up/down/stable)  
  - Belief token staking system  
  - Representativeness warnings  
  - Filters for high-signal, active, and decaying claims

- **Backend API**  
  - `/api/claims` – CRUD operations for claims  
  - `/api/analyze-feedback` – AI-powered feedback analysis  
  - `/api/workflow/process` – Trigger feedback workflow  
  - `/api/search-similar` – Find duplicate claims using semantic search

---

## Cloudflare Products Used

| Product | Purpose |
|---------|---------|
| Workers | Runtime & API endpoints |
| D1 Database | Persistent storage for claims, feedback, and stakes |
| Workers AI | Claim extraction and sentiment analysis |
| Workflows | Orchestrates multi-step feedback processing |
| AI Search | Semantic deduplication of similar claims |
| KV Storage | Optional caching for frequently accessed claims |

---

## Project Structure

```
feedback-market/
├── src/
│   ├── index.js                 # Main Worker entry point
│   └── workflows/
│       └── feedback-pipeline.js # Workflow definition
├── migrations/
│   └── 0001_initial_schema.sql  # D1 schema
├── wrangler.jsonc               # Cloudflare configuration
├── package.json
└── README.md
```

---

## Quick Start

1. Clone the repository:
```
git clone <repo-url>
cd feedback-market
```

2. Install dependencies:
```
npm install
```

3. Deploy to Cloudflare Workers:
```
npx wrangler deploy
```

4. Test APIs with curl or Postman as needed.
