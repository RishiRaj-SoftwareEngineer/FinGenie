import LegalPage from "@/components/legal-page";

export const metadata = { title: "Financial Disclaimer | FinGenie" };

export default function DisclaimerPage() {
  return <LegalPage title="Financial Disclaimer" intro="FinGenie provides financial information and insights for educational and informational purposes only." sections={[
    { title: "Not financial advice", content: "Content and AI-generated insights do not constitute financial, investment, tax, accounting, or legal advice and should not replace guidance from a qualified professional." },
    { title: "No guarantees", content: "Projections, recommendations, and estimates may rely on incomplete information or assumptions. Past performance and modeled outcomes do not guarantee future results." },
    { title: "Your responsibility", content: "You are solely responsible for reviewing information, verifying its accuracy, evaluating risks, and making decisions appropriate to your circumstances." },
  ]} />;
}
