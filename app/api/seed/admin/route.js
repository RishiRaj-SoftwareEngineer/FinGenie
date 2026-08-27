import { seedAdmin } from "@/actions/seed";

export async function GET() {
  const result = await seedAdmin();
  return Response.json(result);
}
