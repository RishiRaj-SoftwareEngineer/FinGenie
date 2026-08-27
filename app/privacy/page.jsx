import LegalPage from "@/components/legal-page";

export const metadata = { title: "Privacy Policy | FinGenie" };

export default function PrivacyPage() {
  return <LegalPage title="Privacy Policy" intro="This policy explains how FinGenie handles information used to provide its personal-finance features." sections={[
    { title: "Information we use", content: "FinGenie may process account details, financial records you provide, application activity, and technical information needed to operate and secure the service." },
    { title: "How information is used", content: "Information is used to provide dashboards and insights, maintain your account, improve reliability, prevent misuse, and communicate service-related updates." },
    { title: "Data protection", content: "We use reasonable safeguards and limit access to information. No online system can guarantee absolute security, so you should also protect your account credentials." },
    { title: "Your choices", content: "You may review or update your account information and request help concerning your data by contacting support@fingenie.com." },
  ]} />;
}
