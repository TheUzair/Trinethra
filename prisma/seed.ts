/**
 * Seeds a demo user so anyone can log in with one click on the deployed app.
 *
 * Run:  npx tsx prisma/seed.ts
 *   or: npm run db:seed
 *
 * Idempotent — safe to run repeatedly.
 */
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

const DEMO_EMAIL = "demo@trinethra.app";
const DEMO_PASSWORD = "demo1234";
const DEMO_NAME = "Demo Intern";

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { passwordHash, name: DEMO_NAME },
    create: {
      email: DEMO_EMAIL,
      name: DEMO_NAME,
      passwordHash,
    },
  });

  console.log(`✓ Demo user ready: ${user.email} (id: ${user.id})`);
  console.log(`  Password: ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
