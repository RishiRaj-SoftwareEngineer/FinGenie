# AI Features Design & Data Model (MVP)

This document outlines the data model, API surface, algorithm approaches and an MVP plan for the requested features:

1. Smart Categorization
2. Spending Prediction
3. Anomaly Detection
4. Cash Flow Forecast
5. Financial Q&A Chat
6. Personalized Insights
7. Subscription Detector
8. Investment Recommendations

---

## Goals
- Provide accurate, privacy-first offline-capable features.
- Keep initial implementation simple and rule-first, with ML hooks for later improvements.
- Expose thin server APIs that can be implemented as serverless functions or routes.

---

## Data Model (Prisma-style examples)

These models are suggestions compatible with existing Prisma usage in the project.

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  accounts  Account[]
  createdAt DateTime @default(now())
}

model Account {
  id          String        @id @default(cuid())
  user         User         @relation(fields: [userId], references: [id])
  userId       String
  provider     String
  currency     String
  transactions Transaction[]
}

model Transaction {
  id            String   @id @default(cuid())
  account       Account  @relation(fields: [accountId], references: [id])
  accountId     String
  timestamp     DateTime
  amount        Float
  currency      String
  merchant      String?
  description   String?
  categoryId    String?
  category      Category? @relation(fields: [categoryId], references: [id])
  rawMetadata   Json?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Category {
  id    String @id @default(cuid())
  name  String
  rules Json?  // optional rules for rule-based categorization
}

model Subscription {
  id           String   @id @default(cuid())
  user         User     @relation(fields: [userId], references: [id])
  userId       String
  merchant     String
  amount       Float
  currency     String
  cadence      String   // monthly, yearly, weekly
  firstSeenAt  DateTime
  lastSeenAt   DateTime
  active       Boolean  @default(true)
}

model ChatMessage {
  id        String   @id @default(cuid())
  userId    String?
  role      String   // user | bot | system
  content   String
  createdAt DateTime @default(now())
}

model Insight {
  id        String   @id @default(cuid())
  userId    String
  type      String   // e.g., "savings_opportunity"
  payload   Json
  createdAt DateTime @default(now())
}

model Prediction {
  id        String   @id @default(cuid())
  userId    String
  horizon   String   // 7d | 30d | 90d
  metric    String   // e.g., "spending"
  payload   Json     // numeric series, confidence
  createdAt DateTime @default(now())
}

---

## API Surface (MVP endpoints)

- POST `/api/ai/categorize` — body: { userId, transactions: [TransactionInput] } → returns category assignments
- POST `/api/ai/predict/spending` — body: { userId, accountId?, horizon } → returns forecast time series
- POST `/api/ai/anomalies` — body: { userId, accountId?, since } → returns anomaly list
- POST `/api/ai/forecast/cashflow` — body: { userId, horizon } → returns inflow/outflow forecast
- POST `/api/chat` — existing; extend to call LLM with user context and retrieval of documents/insights
- GET `/api/ai/insights` — query: userId → returns personalized one-off insights
- POST `/api/ai/subscriptions/detect` — body: { userId } → returns detected subscriptions
- POST `/api/ai/investments/recommend` — body: { userId, riskProfile?, goals? } → returns recommendations

Responses should be standardized with `status`, `data`, `meta` and small `traceId` for debugging.

---

## Algorithms & Implementation Notes (MVP-first)

1) Smart Categorization
- MVP: deterministic rules + merchant-to-category map. Use fuzzy match on `merchant` & `description`.
- Next: train a small classifier (logistic regression / LightGBM) using features: merchant token embeddings, amount bucket, weekday, description n-grams.
- Store mapping table and allow manual overrides in UI.

2) Spending Prediction
- MVP: time-series decomposition + exponential smoothing (Holt-Winters) on aggregated daily spending by user and category.
- Next: add Prophet or simple RNN/LSTM model for better seasonality handling.

3) Anomaly Detection
- MVP: rolling-window z-score on daily/hourly spending per merchant/category; flag points where |z| > 3.
- Next: isolation forest on transaction feature vectors and seasonality-aware thresholds.

4) Cash Flow Forecast
- MVP: aggregate recurring inflows (paychecks) and recurring outflows (bills/subscriptions), plus predicted spending baseline from spending prediction.
- Next: incorporate scheduled transactions and user-declared income events.

5) Financial Q&A Chat
- MVP: route chat queries to server `/api/chat` which uses prompt + user aggregate context (balances, last 90d summary) and an LLM.
- Add retrieval: index recent transactions and insights (embeddings) and pass top-K to the LLM.

6) Personalized Insights
- MVP: rule-based insights (e.g., "You spent 23% more on dining this month").
- Next: ranking model for the most actionable insights, A/B testing.

7) Subscription Detector
- MVP: group transactions by merchant+amount similarity and periodicity detection (30±3 days window). Mark as subscription if recurring >= 3 occurrences.

8) Investment Recommendations
- MVP: a questionnaire capturing `riskProfile`, time horizon, and available capital. Use rule-based mapping to conservative/moderate/aggressive suggestions (FDs, MF, ETFs).
- Note: disclaimers required. No live trading.

---

## Jobs & Background Tasks
- `categorize-transactions` — batch job to categorize uncategorized transactions (cron or background queue)
- `detect-subscriptions` — periodic scanner for recurring charges
- `generate-predictions` — scheduled daily predictions for dashboard
- `anomaly-scanner` — near-real-time or nightly anomaly detection

Use a job queue (e.g., BullMQ or background worker) and avoid blocking request paths for heavy computation.

---

## Storage, Indexes & Performance
- Index `Transaction.userId`, `Transaction.accountId`, `Transaction.timestamp`, `Transaction.merchant`.
- Store time series aggregates (daily/weekly) in a separate table to speed forecasting.

---

## Privacy & Security
- Keep PII minimal and encrypt sensitive fields in DB if required.
- Rate-limit AI endpoints and require authentication (use existing auth middleware).
- Log minimal data; use trace ids for debugging without exposing raw user data in logs.

---

## MVP Timeline & Prioritization (suggested)
1. Smart Categorization (rules + UI override) — high impact, quick.
2. Subscription Detector — high impact, medium effort.
3. Financial Q&A Chat (LLM integration with transaction context) — high value.
4. Spending Prediction & Cash Flow Forecast — medium effort.
5. Anomaly Detection — medium effort.
6. Personalized Insights — iterative.
7. Investment Recommendations — low/medium, needs compliance checks.

---

## Example: Categorization API (MVP)

Request:
```
POST /api/ai/categorize
{
  "userId": "user_x",
  "transactions": [{ "id":"t_1","merchant":"Starbucks","amount":4.5,"description":"latte" }, ...]
}
```

Response:
```
{ "status":"ok","data": [{ "transactionId":"t_1","category":"Dining" }], "meta":{} }
```

---

## Next steps (if you want me to implement)
1. Create API skeletons under `app/api/ai/*` (server routes + empty handlers).
2. Implement `categorize-transactions` job and admin UI to approve rules.
3. Hook chat UI (`components/chat/ChatLauncher.jsx`) to `/api/chat` retrieval pipeline.

---

If you want, I can scaffold the API routes and a small worker file next — which endpoint should I scaffold first? (I recommend `/api/ai/categorize`.)
