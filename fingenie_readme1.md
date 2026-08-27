# 🧞‍♂️ FinGenie – Your AI Genie for Financial Goals

FinGenie is a full‑stack AI-powered personal finance management platform built with **Next.js 16**, **Prisma**, **PostgreSQL**, and modern UI tooling. It helps users manage accounts, track income/expenses, create budgets, visualize analytics, scan receipts using AI, and receive automated notifications.

---

## 🚀 Tech Stack

### Frontend
- Next.js 16 (App Router)
- React 19
- Tailwind CSS 4
- ShadCN UI + Radix UI
- Recharts (data visualization)
- React Hook Form + Zod (validation)
- Next Themes (dark/light mode)

### Backend
- Next.js Server Actions
- Prisma ORM
- PostgreSQL (via Prisma adapter)
- Clerk Authentication
- Inngest (background jobs & workflows)
- Arcjet (security & protection)

### AI & Automation
- Google Generative AI (receipt scanning & AI features)
- Custom AI-ready structure
- Email automation with React Email + Resend

---

## 📁 Project Structure

```
fingen/
 ├── app/
 │   ├── (auth)/              # Authentication routes
 │   ├── (main)/              # Main application
 │   │   ├── dashboard/
 │   │   ├── account/
 │   │   ├── transaction/
 │   ├── api/
 │   │   ├── inngest/
 │   │   ├── seed/
 ├── actions/                 # Server actions (account, budget, transaction)
 ├── components/              # UI components
 ├── prisma/                  # Database schema & migrations
 ├── lib/                     # Utility & service layer
 ├── emails/                  # Email templates
 ├── hooks/                   # Custom React hooks
 ├── data/                    # Static datasets (categories, landing)
```

---

## ✨ Features

### 🔐 Authentication
- Clerk-based authentication
- Protected routes
- Middleware-based access control

### 💳 Account Management
- Create multiple accounts
- Default account selection
- Account-wise analytics

### 💸 Transaction Management
- Add income & expenses
- Category-based classification
- Date-based filtering
- Transaction table view

### 🧾 AI Receipt Scanner
- Upload receipt
- Extract transaction data using AI
- Auto-fill transaction form

### 📊 Dashboard & Analytics
- Account overview cards
- Budget progress tracking
- Transaction overview charts (Recharts)
- Monthly summaries

### 🎯 Budget System
- Create category-based budgets
- Track spending vs limit
- Visual progress indicators

### 📧 Email System
- Transaction/budget alerts
- React Email templates
- Resend integration

### ⚙️ Background Jobs
- Inngest workflows
- Automated notifications
- Seed database endpoint

---

## 🗄 Database Design (Prisma)

Defined inside:
```
prisma/schema.prisma
```

Includes models such as:
- User
- Account
- Transaction
- Budget

Uses PostgreSQL via Prisma Client.

---

## 🔧 Environment Variables

Create a `.env` file in root:

```
DATABASE_URL=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
ARCJET_KEY=
RESEND_API_KEY=
GOOGLE_GENERATIVE_AI_KEY=
```

---

## 🛠 Installation & Setup

### 1️⃣ Install Dependencies

```
npm install
```

### 2️⃣ Setup Database

```
npx prisma migrate dev
```

### 3️⃣ Run Development Server

```
npm run dev
```

App runs at:
```
http://localhost:3000
```

---

## 📬 Email Development

Preview email templates:

```
npm run email
```

---

## 🌱 Seed Database

```
/api/seed
```

Seeds initial data for development.

---

## 🔐 Security

- Arcjet protection
- Middleware validation
- Server-side validation with Zod
- Auth-protected server actions

---

## 🤖 AI Chatbot Assistant (Gemini Powered)

FinGenie now integrates an advanced **Gemini API powered AI assistant** designed to provide intelligent financial insights and automation.

### 💬 Financial Q&A Bot
Users can ask natural language questions such as:
- "How much did I spend on groceries last month?"
- "What was my highest expense this month?"
- "Am I exceeding my dining budget?"

The assistant:
- Fetches user-specific transaction data
- Generates contextual summaries
- Provides smart financial insights
- Suggests improvements based on spending trends

---

### 🎙 Voice Commands
Users can add transactions using voice input:

Examples:
- "Add Rs.50 coffee expense"
- "Record Rs.2000 salary income"
- "Add Rs.1200 rent for February"
it is not neccessaryto speak Rs. system should understand the currency 

Voice commands are processed via:
1. Speech-to-text conversion
2. Intent detection using Gemini
3. Structured transaction creation in the database

---

## 🧠 Advanced ML Features

### 📈 Investment Recommendations
- Personalized suggestions based on:
  - Risk profile
  - Income patterns
  - Savings rate
  - Spending behavior
- AI-driven portfolio suggestions
- Long-term financial goal alignment

---

### 🔁 Subscription Detector
- Identifies recurring transactions
- Detects subscription-based services
- Suggests cancellation of unused or redundant subscriptions
- Provides monthly subscription cost summary

---

### 💰 Bill Negotiation Tips
- Analyzes recurring bills
- Detects unusually high charges
- Suggests negotiation strategies
- Recommends alternative service providers

---

## 🛠 Gemini API Integration

FinGenie uses **Google Gemini API** for:
- Natural language understanding
- Financial reasoning
- Receipt scanning
- Intelligent summarization
- Tool-based structured responses

Gemini processes structured financial summaries rather than raw database dumps to ensure:
- Lower token usage
- Higher accuracy
- Better security
- Scalable AI architecture

---

## 🚀 Future AI Roadmap

- AI Financial Goal Planner
- Predictive expense forecasting
- Anomaly detection in spending
- Personalized savings automation
- AI-powered credit score insights

---

## 📌 Deployment

Recommended platforms:
- Vercel (for Next.js)
- Railway / Supabase / Neon (PostgreSQL)

Steps:
1. Add environment variables in hosting dashboard
2. Run Prisma migrations in production
3. Configure Clerk production keys

---

## 👨‍💻 Author

**Rishi Raj Pandey**  
Software Engineer  
Project: FinGenie – AI Genie for Financial Goals

---

## 📄 License

Private Project – All Rights Reserved.

---

# 🧞‍♂️ FinGenie
> Manage money smarter with AI-powered insights.

