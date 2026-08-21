import { SamsungLocationProvider } from "./SamsungLocationProvider";
import { config } from "../../lib/config";

async function main() {
  const provider = new SamsungLocationProvider();
  const devices = await provider.getDevices();
  if (!config.samsungDeviceId) {
    console.log(JSON.stringify({ status: "SELECT_DEVICE", devices }, null, 2));
    return;
  }
  const device = devices.find((item) => item.providerDeviceId === config.samsungDeviceId);
  const sample = await provider.getCurrentLocation(config.samsungDeviceId);
  console.log(
    JSON.stringify(
      {
        deviceId: sample.deviceId,
        deviceName: device?.name,
        latitude: sample.latitude,
        longitude: sample.longitude,
        accuracy: sample.accuracy ?? null,
        providerTimestamp: sample.providerTimestamp?.toISOString() ?? null,
        collectedAt: sample.collectedAt.toISOString()
      },
      null,
      2
    )
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Samsung POC failed");
  process.exitCode = 1;
});
