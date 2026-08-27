import LegalPage from "@/components/legal-page";

export const metadata = { title: "Terms of Service | FinGenie" };

export default function TermsPage() {
  return <LegalPage title="Terms of Service" intro="By using FinGenie, you agree to use the service responsibly and in accordance with these terms." sections={[
    { title: "Use of the service", content: "You are responsible for the accuracy of information you enter, keeping your account secure, and using FinGenie only for lawful personal-finance purposes." },
    { title: "Service availability", content: "Features may change, be interrupted, or be discontinued as the application evolves. We work to keep the service reliable but do not guarantee uninterrupted availability." },
    { title: "No professional advice", content: "FinGenie offers informational tools and automated insights. You remain responsible for financial decisions and should consult a qualified professional when appropriate." },
    { title: "Limitation of liability", content: "To the extent permitted by law, FinGenie is not responsible for losses arising from decisions made using informational outputs or from events outside its reasonable control." },
  ]} />;
}
