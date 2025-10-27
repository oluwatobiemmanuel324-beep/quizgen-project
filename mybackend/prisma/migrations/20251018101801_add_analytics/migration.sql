-- CreateTable
CREATE TABLE "Analytics" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER,
    "ageRange" TEXT,
    "country" TEXT,
    "city" TEXT,
    "deviceType" TEXT,
    "activeHours" TEXT,
    "interests" TEXT,
    "engagement" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
