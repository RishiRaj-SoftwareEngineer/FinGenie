import {
  BarChart3,
  Receipt,
  PieChart,
  CreditCard,
  Globe,
  Zap,
} from "lucide-react";

// Stats Data
export const statsData = [
  {
    value: "50K+",
    label: "Active Users",
  },
  {
    value: "Rs.2B+",
    label: "Transactions Tracked",
  },
  {
    value: "99.9%",
    label: "Uptime",
  },
  {
    value: "4.9/5",
    label: "User Rating",
  },
];

// Features Data
export const featuresData = [
  {
    icon: <BarChart3 className="h-8 w-8 text-blue-600" />,
    title: "Spending Analytics",
    description:
      "See clear summaries of where your money goes each month",
  },
  {
    icon: <Receipt className="h-8 w-8 text-blue-600" />,
    title: "Receipt Tracking",
    description:
      "Keep all your receipts and notes organized in one place",
  },
  {
    icon: <PieChart className="h-8 w-8 text-blue-600" />,
    title: "Budget Planning",
    description: "Create and manage budgets you can stick to",
  },
  {
    icon: <CreditCard className="h-8 w-8 text-blue-600" />,
    title: "Expense Tracking",
    description: "Log income and expenses with clean categories",
  },
  {
    icon: <Globe className="h-8 w-8 text-blue-600" />,
    title: "Goals & Progress",
    description: "Set goals and track your progress over time",
  },
  {
    icon: <Zap className="h-8 w-8 text-blue-600" />,
    title: "Reports",
    description: "Download monthly summaries for easy review",
  },
];

// How It Works Data
export const howItWorksData = [
  {
    icon: <CreditCard className="h-8 w-8 text-blue-600" />,
    title: "1. Create Your Account",
    description:
      "Get started in minutes with our simple and secure sign-up process",
  },
  {
    icon: <BarChart3 className="h-8 w-8 text-blue-600" />,
    title: "2. Track Your Spending",
    description:
      "Automatically categorize and track your transactions in real-time",
  },
  {
    icon: <PieChart className="h-8 w-8 text-blue-600" />,
    title: "3. Get Insights",
    description:
      "Review simple summaries to stay on top of your goals",
  },
];

// Testimonials Data
export const testimonialsData = [
  {
    name: "Ritu Sharma",
    role: "Small Business Owner",
    image: "https://randomuser.me/api/portraits/women/75.jpg",
    quote:
      "Fingenie keeps my business expenses organized and easy to review.",
  },
  {
    name: "Suresh Adhikari",
    role: "Freelancer",
    image: "https://randomuser.me/api/portraits/men/75.jpg",
    quote:
      "The receipt scanning feature saves me hours each month. Now I can focus on my work instead of manual data entry and expense tracking.",
  },
  {
    name: "Puja Regmi",
    role: "Financial Advisor",
    image: "https://randomuser.me/api/portraits/women/74.jpg",
    quote:
      "I recommend Fingenie to clients who want a simple way to track spending.",
  },
];
