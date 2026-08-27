// lib/prisma.js
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// make sure you have DATABASE_URL in your .env file
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

export const db = new PrismaClient({ adapter });
