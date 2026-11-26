import { prisma } from "../src/db/prisma";
import { seedReferenceData } from "./seed-data";

seedReferenceData()
    .then(() => console.log("Seed completed"))
    .catch((error) => {
        console.error("Seed failed:", error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());