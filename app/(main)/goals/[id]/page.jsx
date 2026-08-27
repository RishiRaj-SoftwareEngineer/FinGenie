import React from "react";

// Server wrapper that passes goalId to a client component
import GoalDetailClient from "./client";

export default async function GoalPage({ params }) {
  const resolved = await params;
  const { id } = resolved || params || {};
  return <GoalDetailClient goalId={id} />;
}
