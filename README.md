# 🧞‍♂️ FinGenie

> **AI-powered personal finance management for smarter everyday money decisions.**

FinGenie is a full-stack personal finance application built with **Next.js 16, React 19, Prisma, PostgreSQL, Clerk, and Google Gemini**. It brings accounts, transactions, budgets, financial goals, analytics, categorization, forecasting, and an AI financial assistant into one place.

The project is designed around a simple idea: **turn financial data into useful, understandable actions.**

---

## ✨ What FinGenie Does

### 💳 Accounts & Transactions
- Create and manage multiple current and savings accounts.
- Set a default account.
- Record income and expenses.
- Organize transactions by category.
- Track transaction status and dates.
- Support recurring transactions and recurring intervals.
- Store optional receipt URLs.

### 📊 Dashboard & Analytics
- View account and transaction summaries.
- Monitor cash flow and spending.
- Visualize financial activity with charts.
- Review category-level spending.
- Generate monthly and historical financial summaries.

### 💰 Budgets
- Set a personal spending budget.
- Track spending against the budget.
- Support budget alert workflows.
- Surface budget-related insights through the application and AI assistant.

### 🎯 Financial Goals
- Create savings goals with a target amount and timeline.
- Record contributions toward goals.
- Track goal progress.
- Store AI-generated goal analysis such as achievability, monthly targets, timelines, and recommendations.

### 🤖 AI Financial Assistant
FinGenie includes a Gemini-powered assistant that can answer questions using the user's financial context.

Examples:

```text
How much did I spend last month?
What were my biggest expenses this month?
Show my spending on groceries.
Forecast my expenses for the next 3 months.
Show my recent transactions.
What categories are taking most of my budget?
```

The assistant can work with:
- Transaction history
- Cash-flow summaries
- Expense aggregation
- Forecasting
- Categories
- Budgets and goals
- Categorization rules
- Market/news insight endpoints

Financial responses are generated from structured application data rather than exposing the entire database directly to the model.

### 🧠 Smart Categorization
FinGenie supports AI-assisted transaction categorization with:
- Confidence thresholds
- User-defined categorization rules
- Preview runs
- Applied/reverted categorization runs
- Audit information for category changes

### 📈 Forecasting
The AI layer can produce financial forecasts at different granularities:
- Daily
- Weekly
- Monthly
- Yearly

Forecast horizons are parsed from natural-language questions and constrained to reasonable limits.

### 🛡️ Authentication, Security & Administration
- Clerk authentication
- Protected application routes
- Arcjet security/protection
- Server-side validation with Zod
- Admin-only areas
- Audit logs for administrative actions
- Application settings stored in the database

### 📧 Email & Background Automation
- React Email templates
- Resend integration
- Inngest background functions
- Automated notification workflows
- Budget and goal alert support

---

## 🧱 Tech Stack

| Area | Technology |
| --- | --- |
| Framework | Next.js 16 |
| UI | React 19 |
| Styling | Tailwind CSS 4 |
| Components | Radix UI / custom UI components |
| Authentication | Clerk |
| Database | PostgreSQL |
| ORM | Prisma |
| Validation | Zod |
| Charts | Recharts / Chart.js |
| AI | Google Gemini |
| Background Jobs | Inngest |
| Security | Arcjet |
| Email | React Email + Resend |
| Icons | Lucide React |
| Notifications | Sonner |

---

## 🗂️ Project Structure

```text
fingen/
├── app/
│   ├── (auth)/                 # Authentication pages/layout
│   ├── (main)/                 # Main application routes
│   │   ├── admin/              # Admin dashboard and tools
│   │   ├── chat-history/       # AI assistant history
│   │   ├── dashboard/          # Main financial dashboard
│   │   └── goals/              # Financial goals
│   ├── api/
│   │   ├── accounts/           # Account API
│   │   ├── chat/               # AI assistant API
│   │   ├── contributions/      # Goal contribution API
│   │   ├── goals/              # Goal API
│   │   ├── inngest/             # Background job endpoint
│   │   ├── market/              # Market insight endpoints
│   │   ├── me/                  # Current-user API
│   │   └── seed/                # Development seed endpoint
│   ├── globals.css
│   └── layout.js
│
├── actions/                    # Server actions
│   ├── account.js
│   ├── budget.js
│   ├── dashboard.js
│   ├── seed.js
│   ├── send-emails.js
│   └── tranaction.js
│
├── components/                 # Shared UI and feature components
│   ├── admin/
│   ├── chat/
│   └── ui/
│
├── data/                       # Static application data
├── emails/                     # React Email templates
├── hooks/                      # Custom React hooks
├── lib/
│   ├── ai/                     # AI categorization and forecasting
│   ├── inngest/                # Background job configuration
│   ├── market/                 # Market/news integrations
│   └── *.js                    # Shared services and utilities
│
├── prisma/
│   └── schema.prisma           # Database schema
│
├── public/                     # Static assets
├── middleware.js               # Route/auth/security middleware
├── next.config.mjs
├── package.json
└── README.md
```

---

## 🗄️ Data Model

The Prisma schema currently includes models for:

- `User`
- `Account`
- `Transaction`
- `Budget`
- `Goal`
- `Contribution`
- `ChatMessage`
- `CategoryRule`
- `CategorizeRun`
- `CategorizeUpdate`
- `AuditLog`
- `Setting`

The database uses PostgreSQL and Prisma Client.

The schema also supports:
- User roles (`USER`, `ADMIN`)
- Current and savings accounts
- Income/expense transaction types
- Pending/completed/failed transaction states
- Daily/weekly/monthly/yearly recurring transactions
- Goal contributions
- AI categorization history
- Administrative auditing

---

## 🚀 Getting Started

### Prerequisites

Install:

- **Node.js** 18+ (a current LTS release is recommended)
- **npm**
- **PostgreSQL**
- A **Clerk** application
- A **Google Gemini API** key

Optional services used by parts of the application:

- Arcjet
- Resend
- Inngest

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root.

Typical configuration includes:

```env
DIRECT_URL=your_postgresql_connection_string

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

ARCJET_KEY=your_arcjet_key

RESEND_API_KEY=your_resend_api_key

GOOGLE_GENERATIVE_AI_KEY=your_gemini_api_key
```

> Do not commit `.env` files or API credentials to source control.

### 3. Set up Prisma

Generate the Prisma client:

```bash
npx prisma generate
```

Apply development migrations:

```bash
npx prisma migrate dev
```

### 4. Start the application

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## 📜 Available Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Create a production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run email` | Start the React Email development environment |

---

## 🧪 Development Workflow

A typical development flow is:

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

Before opening a pull request, run:

```bash
npm run lint
npm run build
```

For database changes:

1. Update `prisma/schema.prisma`.
2. Create a migration with Prisma.
3. Regenerate the Prisma client.
4. Verify affected server actions and API routes.
5. Test the relevant dashboard/admin flows.

---

## 🤖 AI Architecture

The AI functionality is centered around the Gemini integration in:

```text
lib/gemini.js
```

Supporting AI functionality lives in:

```text
lib/ai/
├── categorize.js
└── forecast.js
```

The chat API is exposed through:

```text
app/api/chat/route.js
```

The assistant combines natural-language parsing with application-side financial calculations. This allows questions about dates, categories, transaction counts, confidence thresholds, forecasting horizons, and financial summaries to be translated into structured operations.

### Example AI capabilities

```text
"Show my last 10 transactions"

"How much did I spend last month?"

"Forecast my expenses for the next 6 months"

"Show expenses with confidence above 80%"

"Add a rule: merchant: Starbucks category: food"
```

---

## 🔐 Security Considerations

FinGenie handles sensitive financial information, so security is a core part of the architecture.

Current protections include:

- Clerk authentication
- Protected routes
- User-scoped database queries
- Server-side validation
- Arcjet protection
- Admin authorization checks
- Administrative audit logging

When adding new APIs or server actions:

- Authenticate the request.
- Resolve the internal user from the Clerk identity.
- Scope database queries to that user.
- Validate request payloads.
- Avoid exposing sensitive financial data to clients unnecessarily.
- Never expose secrets through `NEXT_PUBLIC_*` variables.

---

## 📧 Email Development

Email templates are located in:

```text
emails/
```

Run the email development environment with:

```bash
npm run email
```

Resend is used for application email delivery.

---

## ⚙️ Background Jobs

Inngest integration is located under:

```text
lib/inngest/
```

and exposed through:

```text
app/api/inngest/route.js
```

Background workflows can be used for operations such as:

- Automated alerts
- Scheduled financial processing
- Recurring transaction handling
- Notification workflows

---

## 🌱 Development Seed

The project includes seed functionality under:

```text
actions/seed.js
app/api/seed/route.js
```

Use the seed endpoint only in an appropriate development environment and never expose development-only seed functionality publicly without proper protection.

---

## 📊 Market Insights

Market-related functionality is available under:

```text
lib/market/
app/api/market/
```

The current market endpoint includes a lightweight insight implementation and should be treated as an application-level placeholder unless connected to a verified market-data provider.

For production financial decisions, market data should come from a reliable, authenticated, and appropriately licensed provider.

---

## 🚢 Deployment

FinGenie is suitable for deployment on platforms that support Next.js and PostgreSQL.

A common setup is:

- **Application:** Vercel or another Next.js-compatible host
- **Database:** PostgreSQL through a managed provider
- **Authentication:** Clerk
- **AI:** Google Gemini
- **Email:** Resend
- **Background jobs:** Inngest
- **Security:** Arcjet

Before production deployment:

1. Configure production environment variables.
2. Configure production Clerk keys and authorized domains.
3. Configure the production PostgreSQL database.
4. Apply Prisma migrations.
5. Configure Gemini, Resend, Arcjet, and Inngest integrations as required.
6. Verify authentication and authorization.
7. Run the production build.
8. Review logging, audit behavior, and API access controls.

---

## 🛣️ Roadmap

Potential areas for continued development include:

- More advanced financial goal planning
- Improved expense forecasting
- Spending anomaly detection
- Automated savings recommendations
- More robust investment research integrations
- Real market-data providers
- Subscription detection and recurring-spend analysis
- Bill optimization insights
- Voice-based transaction entry
- Expanded financial reports and exports
- Automated financial health scoring

---

## 🤝 Contributing

FinGenie is currently a private project.

For internal development:

1. Create a focused branch.
2. Keep changes scoped to the relevant feature.
3. Update Prisma migrations when the data model changes.
4. Run linting and production builds before merging.
5. Avoid committing secrets or generated credentials.
6. Document new APIs, environment variables, and major architectural changes.

---

## 👨‍💻 Author

**Rishi Raj Pandey**  
Software Engineer

**Project:** FinGenie – AI-powered personal finance management

---

## 📄 License

This project is currently private and is not licensed for redistribution.

---

<div align="center">

### 🧞‍♂️ FinGenie

**Manage money smarter. Understand your finances better.**

</div>
