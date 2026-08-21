import { SamsungProviderError } from "./errors";

const WEBDRIVER_URL = process.env.SAMSUNG_FIND_WEBDRIVER_URL || "http://samsung-browser:4444";
const SAMSUNG_FIND_URL = "https://samsungfind.samsung.com";

type BrowserState = {
  sessionId?: string;
};

const globalBrowser = globalThis as typeof globalThis & { samsungFindBrowser?: BrowserState };
const browserState = (globalBrowser.samsungFindBrowser ??= {});

async function webdriver(path: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    return await fetch(`${WEBDRIVER_URL}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
      cache: "no-store",
      signal: controller.signal
    });
  } catch {
    throw new SamsungProviderError(
      "PROVIDER_UNAVAILABLE",
      "The private Samsung Find browser is not ready. Start the Docker browser service and try again.",
      true
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function sessionIsAlive(sessionId: string) {
  const response = await webdriver(`/session/${encodeURIComponent(sessionId)}/url`);
  return response.ok;
}

async function discoverExistingSession() {
  const response = await webdriver("/status");
  if (!response.ok) return undefined;
  const payload = (await response.json().catch(() => null)) as {
    value?: { nodes?: Array<{ slots?: Array<{ session?: { sessionId?: string } }> }> };
  } | null;
  for (const node of payload?.value?.nodes || []) {
    for (const slot of node.slots || []) {
      if (slot.session?.sessionId && (await sessionIsAlive(slot.session.sessionId))) {
        browserState.sessionId = slot.session.sessionId;
        return slot.session.sessionId;
      }
    }
  }
  return undefined;
}

async function createSession() {
  const response = await webdriver("/session", {
    method: "POST",
    body: JSON.stringify({
      capabilities: {
        alwaysMatch: {
          browserName: "chrome",
          pageLoadStrategy: "eager",
          "goog:chromeOptions": {
            args: [
              "--disable-dev-shm-usage",
              "--start-maximized",
              "--user-data-dir=/home/seluser/.config/samsung-profile"
            ],
            prefs: {
              "credentials_enable_service": false,
              "profile.password_manager_enabled": false
            }
          }
        }
      }
    })
  });
  const payload = (await response.json().catch(() => null)) as
    | { value?: { sessionId?: string; message?: string }; sessionId?: string }
    | null;
  const sessionId = payload?.value?.sessionId || payload?.sessionId;
  if (!response.ok || !sessionId) {
    throw new SamsungProviderError(
      "PROVIDER_UNAVAILABLE",
      "Could not create the private Samsung Find browser session. Restart the browser service and try again.",
      true
    );
  }
  browserState.sessionId = sessionId;
  await webdriver(`/session/${encodeURIComponent(sessionId)}/goog/cdp/execute`, {
    method: "POST",
    body: JSON.stringify({
      cmd: "Emulation.setTimezoneOverride",
      params: { timezoneId: "Asia/Kolkata" }
    })
  }).catch(() => undefined);
  return sessionId;
}

export async function getSamsungFindBrowserStatus() {
  if (!browserState.sessionId) {
    const recovered = await discoverExistingSession();
    return { connected: Boolean(recovered) };
  }
  if (!(await sessionIsAlive(browserState.sessionId))) {
    browserState.sessionId = undefined;
    return { connected: false };
  }
  return { connected: true };
}

export async function connectSamsungFindBrowser() {
  let sessionId = browserState.sessionId || (await discoverExistingSession());
  if (!sessionId || !(await sessionIsAlive(sessionId))) sessionId = await createSession();

  const response = await webdriver(`/session/${encodeURIComponent(sessionId)}/url`, {
    method: "POST",
    body: JSON.stringify({ url: SAMSUNG_FIND_URL })
  });
  if (!response.ok) {
    browserState.sessionId = undefined;
    throw new SamsungProviderError(
      "PROVIDER_UNAVAILABLE",
      "The browser started but Samsung Find could not be opened.",
      true
    );
  }
  return { connected: true };
}

export async function disconnectSamsungFindBrowser() {
  const sessionId = browserState.sessionId;
  browserState.sessionId = undefined;
  if (!sessionId) return;
  await webdriver(`/session/${encodeURIComponent(sessionId)}`, { method: "DELETE" }).catch(() => undefined);
}

export type SamsungFindExtraction = {
  status: "FOUND" | "AUTH_REQUIRED" | "NO_LOCATION";
  devices?: Array<{
    name: string;
    status: string;
    address?: string;
  }>;
  extractedAt: string;
};

export async function extractSamsungFindLocation(options: { refresh?: boolean } = {}): Promise<SamsungFindExtraction> {
  const sessionId = browserState.sessionId || (await discoverExistingSession());
  if (!sessionId || !(await sessionIsAlive(sessionId))) {
    browserState.sessionId = undefined;
    throw new SamsungProviderError("AUTH_REQUIRED", "Connect the Samsung Find browser first.");
  }

  if (options.refresh) {
    const refreshResponse = await webdriver(`/session/${encodeURIComponent(sessionId)}/refresh`, {
      method: "POST",
      body: JSON.stringify({})
    });
    if (!refreshResponse.ok) {
      throw new SamsungProviderError(
        "PROVIDER_UNAVAILABLE",
        "Samsung Find could not refresh its current device state.",
        true
      );
    }
    // Samsung renders the device list after the browser-level load event. Give the
    // authenticated application time to replace its previous location snapshot.
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  // Extraction happens inside Samsung's page. Only normalized location fields leave the
  // browser; cookies, storage, form fields, request headers, and raw page content do not.
  const script = String.raw`
    const pageUrl = String(location.href);
    const extractedAt = new Date().toISOString();
    const hasVisibleSignIn = Array.from(document.querySelectorAll("a, button")).some((element) => {
      const style = getComputedStyle(element);
      const visible = style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
      return visible && /^(?:sign|log)\s*in$/i.test((element.textContent || "").trim());
    });
    if (/\/login(?:[/?#]|$)/i.test(pageUrl) || hasVisibleSignIn) return { status: "AUTH_REQUIRED", extractedAt };

    const bodyText = document.body?.innerText || "";
    const lines = bodyText.split("\n").map((line) => line.trim()).filter(Boolean);
    const devices = [];
    const devicesStart = lines.indexOf("Devices");
    if (devicesStart >= 0) {
      for (let index = devicesStart + 1; index + 1 < lines.length;) {
        if (lines[index] === "Devices" || lines[index] === "Items") break;
        const name = lines[index++];
        const status = lines[index++] || "Unknown";
        if (!name || /^(?:Devices|Items)$/i.test(name)) break;
        let address;
        if (index < lines.length && !/^(?:Devices|Items)$/i.test(lines[index])) address = lines[index++];
        devices.push({ name: name.slice(0, 160), status: status.slice(0, 80), address: address?.slice(0, 300) });
      }
    }
    const hasDeviceLocation = devices.some((device) => device.address && !/location unknown/i.test(device.address));
    if (!hasDeviceLocation) {
      return { status: "NO_LOCATION", devices, extractedAt };
    }
    return { status: "FOUND", devices, extractedAt };
  `;

  let latestExtraction: SamsungFindExtraction | undefined;
  const attempts = options.refresh ? 7 : 1;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await webdriver(`/session/${encodeURIComponent(sessionId)}/execute/sync`, {
      method: "POST",
      body: JSON.stringify({ script, args: [] })
    });
    const payload = (await response.json().catch(() => null)) as
      | { value?: SamsungFindExtraction | { error?: string } }
      | null;
    if (!response.ok || !payload?.value || "error" in payload.value) {
      throw new SamsungProviderError(
        "PROVIDER_UNAVAILABLE",
        "Samsung Find is open, but its location page could not be read.",
        true
      );
    }
    latestExtraction = payload.value as SamsungFindExtraction;
    if (latestExtraction.status === "AUTH_REQUIRED" || latestExtraction.devices?.length) {
      return latestExtraction;
    }
    if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 1_250));
  }
  return latestExtraction!;
}
