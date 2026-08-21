import { prisma } from "../src/lib/db";
import { config } from "../src/lib/config";

async function main() {
  const user = await prisma.user.upsert({
    where: { email: config.adminEmail },
    update: {},
    create: { email: config.adminEmail, name: "Owner" }
  });
  await prisma.device.upsert({
    where: {
      provider_providerDeviceId: {
        provider: config.locationProvider,
        providerDeviceId: config.samsungDeviceId || "mock-galaxy-s24"
      }
    },
    update: { enabled: true },
    create: {
      userId: user.id,
      provider: config.locationProvider,
      providerDeviceId: config.samsungDeviceId || "mock-galaxy-s24",
      deviceName: config.locationProvider === "mock" ? "My Galaxy (Demo)" : "My Galaxy",
      model: "Galaxy",
      enabled: true
    }
  });
}

main().finally(() => prisma.$disconnect());
