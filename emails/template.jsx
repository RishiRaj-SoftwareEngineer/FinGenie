import {
  Html,
  Head,
  Body,
  Preview,
  Section,
  Text,
  Heading,
  Container,
} from "@react-email/components";
import * as React from "react";

export default function Email({
  userName = "",
  type = "monthly-report",
  data = {},
}) {
  if (type === "monthly-report") {
    return (
      <Html>
        <Head />
        <Preview>Your Monthly Financial Report</Preview>
        <Body style={styles.body}>
          <Container style={styles.container}>
            <Heading style={styles.title}>Monthly Financial Report</Heading>

            <Text style={styles.text}>Hello {userName},</Text>
            <Text style={styles.text}>
              Here&rsquo;s your financial summary for {data?.month}:
            </Text>

            {/* Main Stats */}
            <Section style={styles.statsContainer}>
              <div style={styles.stat}>
                <Text style={styles.text}>Total Income</Text>
                <Text style={styles.heading}>
                  Rs.{data?.stats.totalIncome?.toFixed(2)}
                </Text>
              </div>
              <div style={styles.stat}>
                <Text style={styles.text}>Total Expenses</Text>
                <Text style={styles.heading}>
                  Rs.{data?.stats.totalExpenses?.toFixed(2)}
                </Text>
              </div>
              <div style={styles.stat}>
                <Text style={styles.text}>Net</Text>
                <Text style={styles.heading}>
                  Rs.
                  {(
                    (data?.stats.totalIncome || 0) -
                    (data?.stats.totalExpenses || 0)
                  ).toFixed(2)}
                </Text>
              </div>
            </Section>
            {/* Category Breakdown */}
            {data?.stats?.byCategory && (
              <Section style={styles.section}>
                <Heading style={styles.heading}>Expenses by Category</Heading>
                {Object.entries(data?.stats.byCategory).map(
                  ([category, amount]) => (
                    <div
                      key={category}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 6,
                      }}
                    >
                      <Text style={styles.text}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}:-
                      </Text>
                      <Text style={styles.text}>
                        Rs. {Number(amount).toFixed(2)}
                      </Text>
                    </div>
                  ),
                )}
              </Section>
            )}

            {/* AI Insights */}
            {data?.insights && (
              <Section style={styles.section}>
                <Heading style={styles.heading}>FinGenie Insights</Heading>
                {data.insights.map((insight, index) => (
                  <Text key={index} style={styles.text}>
                    • {insight}
                  </Text>
                ))}
              </Section>
            )}

            <Text style={styles.footer}>
              Thank you for using FinGenie. Keep tracking your finances for
              better financial health!
            </Text>
          </Container>
        </Body>
      </Html>
    );
  }
  if (type === "budget-alert") {
    return (
      <Html>
        <Head />
        <Preview>Budget Alert</Preview>
        <Body style={styles.body}>
          <Container style={styles.container}>
            <Heading style={styles.title}>Budget Alert</Heading>
            <Text style={styles.text}>Hello {userName},</Text>
            <Text style={styles.text}>
              You&rsquo;ve used {data?.percentageUsed.toFixed(1)}% of your
              monthly budget.
            </Text>
            <Section style={styles.statsContainer}>
              <div style={styles.stat}>
                <Text style={styles.text}>Budget Amount</Text>
                <Text style={styles.heading}>Rs.{data?.budgetAmount}</Text>
              </div>
              <div style={styles.stat}>
                <Text style={styles.text}>Spent So Far</Text>
                <Text style={styles.heading}>Rs.{data?.totalExpenses}</Text>
              </div>
              <div style={styles.stat}>
                <Text style={styles.text}>Remaining</Text>
                <Text style={styles.heading}>
                  Rs.{data?.budgetAmount - data?.totalExpenses}
                </Text>
              </div>
            </Section>
          </Container>
        </Body>
      </Html>
    );
  }
  if (type === "goal-completed") {
    return (
      <Html>
        <Head />
        <Preview>Goal Completed</Preview>
        <Body style={styles.body}>
          <Container style={styles.container}>
            <Heading style={styles.title}>Congratulations!</Heading>
            <Text style={styles.text}>Hello {userName},</Text>
            <Text style={styles.text}>
              You have completed your goal: <strong>{data?.goalTitle}</strong>.
            </Text>
            <Section style={styles.section}>
              <Text style={styles.text}>Goal Target: Rs.{data?.target}</Text>
              <Text style={styles.text}>Total Saved: Rs.{data?.total}</Text>
            </Section>
            <Text style={styles.footer}>
              Great work — keep building momentum!
            </Text>
          </Container>
        </Body>
      </Html>
    );
  }

  if (type === "goal-warning") {
    return (
      <Html>
        <Head />
        <Preview>Goal Monthly Reminder</Preview>
        <Body style={styles.body}>
          <Container style={styles.container}>
            <Heading style={styles.title}>Goal Monthly Check</Heading>
            <Text style={styles.text}>Hello {userName},</Text>
            <Text style={styles.text}>
              A quick reminder about your goal:{" "}
              <strong>{data?.goalTitle}</strong>.
            </Text>
            <Section style={styles.section}>
              <Text style={styles.text}>
                Contributed this month: Rs.{data?.contributedThisMonth}
              </Text>
              <Text style={styles.text}>
                Required monthly contribution: Rs.{data?.requiredMonthly}
              </Text>
              <Text style={styles.text}>Remaining: Rs.{data?.remaining}</Text>
            </Section>
            <Text style={styles.footer}>
              If you'd like, increase your monthly contribution to stay on
              track.
            </Text>
          </Container>
        </Body>
      </Html>
    );
  }
}

const styles = {
  body: {
    backgroundColor: "#f6f9fc",
    fontFamily: "-apple-system, sans-serif",
  },
  container: {
    backgroundColor: "#ffffff",
    margin: "0 auto",
    padding: "20px",
    borderRadius: "5px",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
  },
  title: {
    color: "#1f2937",
    fontSize: "32px",
    fontWeight: "bold",
    textAlign: "center",
    margin: "0 0 20px",
  },
  heading: {
    color: "#1f2937",
    fontSize: "20px",
    fontWeight: "600",
    margin: "0 0 16px",
  },
  text: {
    color: "#4b5563",
    fontSize: "16px",
    margin: "0 0 16px",
  },
  section: {
    marginTop: "32px",
    padding: "20px",
    backgroundColor: "#f9fafb",
    borderRadius: "5px",
    border: "1px solid #e5e7eb",
  },
  statsContainer: {
    margin: "32px 0",
    padding: "20px",
    backgroundColor: "#f9fafb",
    borderRadius: "5px",
  },
  stat: {
    marginBottom: "16px",
    padding: "12px",
    backgroundColor: "#fff",
    borderRadius: "4px",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    padding: "12px 0",
    borderBottom: "1px solid #e5e7eb",
  },
  footer: {
    color: "#6b7280",
    fontSize: "14px",
    textAlign: "center",
    marginTop: "32px",
    paddingTop: "16px",
    borderTop: "1px solid #e5e7eb",
  },
};
