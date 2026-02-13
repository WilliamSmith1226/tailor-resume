const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding profiles...");

  // Safe insert/update (run multiple times)
  await prisma.profile.upsert({
    where: { name: "bran-chembah" },
    update: {},
    create: {
      name: "bran-chembah",
      resumeText: "",
      customPrompt: null,
      pdfTemplate: 1,
    },
  });

  await prisma.profile.upsert({
    where: { name: "felix-gabriel" },
    update: {},
    create: {
      name: "felix-gabriel",
      resumeText: "",
      customPrompt: null,
      pdfTemplate: 1,
    },
  });

  console.log("Seed completed.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
