# 🧞‍♂️ FinGenie

> **AI-powered personal finance management for smarter everyday money decisions.**

<p align="center">
  <strong>Track. Understand. Plan. Grow.</strong>
</p>

<p align="center">
  FinGenie is a full-stack personal finance application that combines account management,
  transaction tracking, budgets, financial goals, analytics, AI assistance, smart
  categorization, notifications, reports, and administrative tools in one place.
</p>

<p align="center">
  <a href="./Screenshot/">
    <img src="https://img.shields.io/badge/📸%20VIEW%20ALL%20SCREENSHOTS-4F46E5?style=for-the-badge" alt="View All Screenshots" />
  </a>
</p>

---

## 📸 Application Screenshots

Explore the FinGenie interface and see the major application screens directly from the repository.

<p align="center">
  <a href="./Screenshot/">
    <img src="https://img.shields.io/badge/🖼️%20OPEN%20SCREENSHOT%20FOLDER-0F766E?style=for-the-badge&logo=github" alt="Open Screenshot Folder" />
  </a>
</p>

### 🏠 Home Page

<p align="center"><img src="Screenshot/01%20Home_page.png" alt="FinGenie Home Page" width="900" /></p>

### 📊 Account Page

<p align="center"><img src="Screenshot/02%20Account_page.png" alt="FinGenie Account Page" width="900" /></p>

### 💳 Transaction Details

<p align="center"><img src="Screenshot/03%20Transaction%20details%20Page.png" alt="FinGenie Transaction Details" width="900" /></p>

### ➕ Add Transaction — Manual Entry

<p align="center"><img src="Screenshot/04%20Add%20tranaction%20page_Method%201.png" alt="Add Transaction Manual Entry" width="900" /></p>

### 📄 Add Transaction — Statement Import

<p align="center"><img src="Screenshot/04%20Add%20tranaction%20page_Method%202.png" alt="Add Transaction Statement Import" width="900" /></p>

### 🤖 AI Financial Assistant

<p align="center"><img src="Screenshot/05%20Chat%20AI.png" alt="FinGenie AI Financial Assistant" width="900" /></p>

### 🎯 Goals Page

<p align="center"><img src="Screenshot/06%20Goal%20Page.png" alt="FinGenie Goals Page" width="900" /></p>

### 📝 Create Financial Goal

<p align="center"><img src="Screenshot/07%20Create%20Goal.png" alt="Create Financial Goal" width="900" /></p>

### 💡 AI Goal Recommendations

<p align="center"><img src="Screenshot/08%20Recommendation%20Page.png" alt="AI Goal Recommendations" width="900" /></p>

### 🌙 Dark Mode

<p align="center"><img src="Screenshot/09%20Dark%20Mode.png" alt="FinGenie Dark Mode" width="900" /></p>

### 🏦 Create Account

<p align="center"><img src="Screenshot/10%20Create%20Acoount.png" alt="Create Account" width="900" /></p>

### 🎯 Goal Dashboard

<p align="center"><img src="Screenshot/11%20Goal%20Dashboard.png" alt="Goal Dashboard" width="900" /></p>

### 🛡️ Admin Dashboard

<p align="center"><img src="Screenshot/12%20Admin%20Page.png" alt="FinGenie Admin Dashboard" width="900" /></p>

<p align="center">
  <a href="./Screenshot/">
    <img src="https://img.shields.io/badge/📸%20VIEW%20ALL%20SCREENSHOTS-4F46E5?style=for-the-badge" alt="View All Screenshots" />
  </a>
</p>

---

## ✨ Core Features

### 💳 Accounts & Transactions

- Create and manage multiple current and savings accounts.
- Store an optional bank account number.
- Set a default account.
- Record income and expense transactions.
- Assign transactions to categories.
- Track transaction dates and statuses.
- Support daily, weekly, monthly, and yearly recurring transactions.
- Store optional receipt URLs.
- View account-specific transaction history.
- Visualize account activity with charts.
- Export account transaction information as PDF.

### 📄 Statement-Based Transaction Entry

FinGenie provides a statement workflow for adding transactions from financial statements.

- Upload a bank statement PDF.
- Analyze the uploaded statement.
- Review extracted transaction information.
- Add extracted transactions to an account.

### 📊 Dashboard & Analytics

- Account balances.
- Income and expense summaries.
- Recent transactions.
- Monthly expense breakdowns.
- Budget progress.
- Forecast information.
- Financial activity charts.
- Notifications and alerts.

### 💰 Budget Management

- Create a personal spending budget.
- Compare spending against the configured budget.
- Monitor budget utilization.
- Receive budget alerts.
- Access budget information through the AI assistant.

### 🎯 Financial Goals

- Create savings goals with target amounts and timelines.
- Record contributions.
- Track goal completion progress.
- Monitor remaining amounts.
- Receive goal progress and completion notifications.
- Generate AI-assisted goal analysis and recommendations.

AI goal insights can include:

- Achievability score.
- Recommended monthly target.
- Estimated timeline.
- Personalized recommendations.

### 🤖 AI Financial Assistant

FinGenie integrates Google Gemini to provide financial Q&A using structured application data.

Example questions:

```text
How much did I spend last month?

What were my biggest expenses this month?

Show my spending on groceries.

Forecast my expenses for the next 3 months.

Show my recent transactions.

What categories are taking most of my budget?
```

The assistant can work with transactions, accounts, balances, income, expenses, categories,
budgets, goals, forecasts, categorization rules, and market/news information.

### 🧠 AI-Assisted Transaction Categorization

- AI/model-based category suggestions.
- User-defined categorization rules.
- Merchant/description matching.
- Confidence thresholds.
- Preview categorization runs.
- Applied categorization runs.
- Revert support.
- Categorization audit history.

### 📈 Financial Forecasting

The AI layer supports:

- Daily forecasting.
- Weekly forecasting.
- Monthly forecasting.
- Yearly forecasting.

Forecast horizons can be interpreted from natural-language requests and constrained to reasonable limits.

### 🔔 Notifications & Automated Alerts

- Budget usage alerts.
- Goal completion notifications.
- Goal progress or shortfall notifications.
- Automated financial reminders.

### 📧 Email Automation

FinGenie uses React Email and Resend for application email workflows, including budget and goal notifications.

### ⚙️ Background Processing

Inngest supports scheduled/background workflows such as:

- Budget checks.
- Goal progress checks.
- Notification creation.
- Email alerts.
- Recurring financial processing.

### 📈 Market & News Insights

Market/news functionality is available under `lib/market/` and includes market/share-price lookup,
financial news retrieval, and lightweight news sentiment functionality.

> Market information should be treated as informational only. Production financial decisions should use reliable, authenticated, and appropriately licensed market-data providers.

### 🌙 Modern UI

- Responsive layouts.
- Light and dark themes.
- Reusable UI components.
- Charts and progress indicators.
- Notifications, dialogs, drawers, forms, tables, and selectors.

---

## 🛡️ Authentication, Security & Administration

### Authentication

FinGenie uses **Clerk** for authentication and protected application access.

### Security

- Protected application routes.
- User-scoped database queries.
- Server-side validation with Zod.
- Arcjet protection.
- Admin authorization checks.
- Administrative audit logging.
- Server-side handling of external-service secrets.

### Admin Dashboard

The admin area provides management and monitoring screens for:

- Dashboard
- Users
- Accounts
- Transactions
- Budgets
- Goals
- Reports
- Settings

---

## 🧱 Technology Stack

| Area | Technology |
| --- | --- |
| Framework | Next.js 16 |
| Frontend | React 19 |
| Styling | Tailwind CSS 4 |
| UI Components | Radix UI + Custom Components |
| Authentication | Clerk |
| Database | PostgreSQL |
| ORM | Prisma |
| Validation | Zod |
| Charts | Recharts + Chart.js |
| AI | Google Gemini |
| Background Jobs | Inngest |
| Security | Arcjet |
| Email | React Email + Resend |
| Icons | Lucide React |
| Notifications | Sonner |
| PDF Export | html2pdf.js |

---

## 🗂️ Project Structure

```text
fingen/
├── app/
│   ├── (auth)/
│   │   ├── sign-in/
│   │   └── sign-up/
│   ├── (main)/
│   │   ├── account/
│   │   ├── admin/
│   │   ├── chat-history/
│   │   ├── dashboard/
│   │   ├── goals/
│   │   └── transaction/
│   ├── api/
│   │   ├── accounts/
│   │   ├── admin/
│   │   ├── ai/
│   │   ├── chat/
│   │   ├── contributions/
│   │   ├── goals/
│   │   ├── inngest/
│   │   ├── market/
│   │   ├── me/
│   │   ├── notifications/
│   │   ├── reports/
│   │   └── seed/
│   ├── disclaimer/
│   ├── privacy/
│   ├── terms/
│   ├── globals.css
│   └── layout.js
├── actions/
├── components/
├── data/
├── docs/
├── emails/
├── hooks/
├── lib/
│   ├── ai/
│   ├── inngest/
│   └── market/
├── prisma/
├── public/
├── scripts/
├── Screenshot/
│   ├── 01 Home_page.png
│   ├── 02 Account_page.png
│   ├── 03 Transaction details Page.png
│   ├── 04 Add tranaction page_Method 1.png
│   ├── 04 Add tranaction page_Method 2.png
│   ├── 05 Chat AI.png
│   ├── 06 Goal Page.png
│   ├── 07 Create Goal.png
│   ├── 08 Recommendation Page.png
│   ├── 09 Dark Mode.png
│   ├── 10 Create Acoount.png
│   ├── 11 Goal Dashboard.png
│   └── 12 Admin Page.png
├── middleware.js
├── next.config.mjs
├── package.json
├── prisma.config.ts
└── README.md
```

---

## 🗄️ Database Model

The Prisma schema includes major models for:

- `User`
- `Account`
- `Transaction`
- `Budget`
- `Goal`
- `Contribution`
- `Notification`
- `ChatSession`
- `ChatMessage`
- `CategoryRule`
- `CategorizeRun`
- `CategorizeUpdate`
- `AuditLog`
- `Setting`

The database supports Clerk identity mapping, `USER` and `ADMIN` roles, current and savings accounts,
income/expense transactions, transaction states, recurring transactions, goal contributions,
AI categorization history, notifications, chat sessions, and administrative auditing.

---

## 🚀 Getting Started

### Prerequisites

Install:

- **Node.js 18+** — a current LTS release is recommended.
- **npm**
- **PostgreSQL**
- A **Clerk** application.
- A **Google Gemini API** key.

Optional integrations include Arcjet, Resend, Inngest, and a news API provider.

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd fingen
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the project root.

```env
DATABASE_URL=your_postgresql_connection_string
DIRECT_URL=your_direct_postgresql_connection_string

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=your_gemini_model

ARCJET_KEY=your_arcjet_key
RESEND_API_KEY=your_resend_api_key
NEWS_API_KEY=your_news_api_key

SEED_ADMIN_EMAIL=your_admin_email
```

> **Important:** Never commit `.env` files, database credentials, API keys, or other secrets to Git.

### 4. Generate Prisma Client

```bash
npx prisma generate
```

### 5. Apply Database Migrations

```bash
npx prisma migrate dev
```

### 6. Start the Development Server

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## 📜 Available Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Build the application for production |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run email` | Start the React Email development environment |

---

## 🧪 Development Workflow

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

Before merging or deploying:

```bash
npm run lint
npm run build
```

For database changes:

1. Update `prisma/schema.prisma`.
2. Create a Prisma migration.
3. Regenerate Prisma Client.
4. Test affected server actions and API routes.
5. Test dashboard, account, transaction, goal, AI, notification, and admin flows.

---

## 🤖 AI Architecture

The AI implementation is centered around:

```text
lib/gemini.js
```

Supporting AI functionality:

```text
lib/ai/
├── categorize.js
└── forecast.js
```

AI chat endpoint:

```text
app/api/chat/route.js
```

AI categorization endpoint:

```text
app/api/ai/categorize/route.js
```

Goal AI endpoints:

```text
app/api/goals/ai-insight-simulate/route.js
app/api/goals/[id]/ai-insight/route.js
```

The application retrieves and transforms relevant financial data server-side before supplying context to the AI layer.

---

## 🔐 Security Guidelines

When creating a new API route or server action:

1. Authenticate the request.
2. Resolve the application user from the authenticated Clerk identity.
3. Scope database queries to the authenticated user.
4. Validate request data on the server.
5. Keep sensitive operations on the server.
6. Do not expose API keys through `NEXT_PUBLIC_*` variables.
7. Protect admin-only operations with role checks.
8. Avoid logging sensitive financial information.
9. Keep development seed functionality protected.

---

## 📧 Email Development

Email templates are located in:

```text
emails/
```

Run the React Email development environment with:

```bash
npm run email
```

Resend is used for application email delivery.

---

## ⚙️ Background Jobs

Inngest configuration is located in:

```text
lib/inngest/
```

and exposed through:

```text
app/api/inngest/route.js
```

Background workflows support budget checks, goal progress checks, notifications, email alerts,
and recurring financial processing.

---

## 🌱 Development Seed

Seed functionality is available under:

```text
actions/seed.js
app/api/seed/route.js
app/api/seed/admin/route.js
```

Use seed functionality only in an appropriate development environment. Never expose an unprotected seed endpoint in production.

---

## 📑 Reports & Export

FinGenie includes reporting and export functionality such as:

- Transaction reports.
- Account transaction exports.
- PDF export support.
- Admin reporting dashboards.

---

## 🛣️ Roadmap

Potential future improvements include:

- More advanced spending anomaly detection.
- Subscription detection and recurring-spend analysis.
- Improved cash-flow forecasting.
- Personalized financial health scoring.
- Automated savings recommendations.
- More advanced financial reports and exports.
- Expanded market-data integrations.
- Better investment research workflows.
- Voice-based transaction entry.
- More advanced financial insights.

> Roadmap items are not necessarily implemented in the current version.

---

## 🤝 Contributing

FinGenie is currently a private project.

For internal development:

1. Create a focused feature branch.
2. Keep changes scoped to the relevant feature.
3. Update Prisma migrations when the data model changes.
4. Run linting and a production build before merging.
5. Test affected financial workflows.
6. Never commit credentials or generated secrets.
7. Document new APIs, environment variables, and architectural changes.

---

## 👨‍💻 Author

**Rishi Raj Pandey**  
Software Engineer

**Project:** FinGenie — AI-powered personal finance management

---

## 📄 License

This project is currently private and is not licensed for redistribution.

---

<div align="center">

### 🧞‍♂️ FinGenie

**Track. Understand. Plan. Grow.**

*AI-powered personal finance management for smarter everyday money decisions.*

<br />

<a href="./Screenshot/">
  <img src="https://img.shields.io/badge/📸%20EXPLORE%20THE%20APP%20SCREENSHOTS-4F46E5?style=for-the-badge" alt="Explore App Screenshots" />
</a>

</div>
