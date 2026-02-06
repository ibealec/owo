import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import envPaths from "env-paths";

// --- OAuth Client IDs ---
// Safe to embed in public clients — device flow does not use a client secret.
const GITHUB_CLIENT_ID = "Iv23liau441BGknzpuiH";

// --- Types ---

interface GitHubToken {
  access_token: string;
  token_type: string;
  scope: string;
  created_at: number;
}

interface AuthStore {
  github?: GitHubToken;
}

// --- Token Storage ---

function getAuthPath(): string {
  const paths = envPaths("owo", { suffix: "" });
  return path.join(paths.config, "auth.json");
}

export function readAuthStore(): AuthStore {
  const authPath = getAuthPath();
  if (!fs.existsSync(authPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(authPath, "utf-8"));
  } catch {
    return {};
  }
}

function writeAuthStore(store: AuthStore): void {
  const authPath = getAuthPath();
  const dir = path.dirname(authPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(authPath, JSON.stringify(store, null, 2), { mode: 0o600 });
}

export function clearAuth(provider?: string): void {
  if (!provider) {
    // Clear all
    const authPath = getAuthPath();
    if (fs.existsSync(authPath)) fs.unlinkSync(authPath);
    return;
  }

  const store = readAuthStore();
  const key = provider.toLowerCase();
  if (key === "github") delete store.github;
  writeAuthStore(store);
}

// --- Browser Utility ---

function openBrowser(url: string): void {
  try {
    if (process.platform === "darwin") {
      execSync(`open ${JSON.stringify(url)}`, { stdio: "ignore" });
    } else if (process.platform === "win32") {
      execSync(`start "" ${JSON.stringify(url)}`, { stdio: "ignore" });
    } else {
      execSync(`xdg-open ${JSON.stringify(url)}`, { stdio: "ignore" });
    }
  } catch {
    // Silently fail — URL is always printed as fallback
  }
}

// --- GitHub Device Flow ---

export async function loginGitHub(): Promise<void> {
  console.error("\nGitHub OAuth Login (Device Flow)\n");

  // Step 1: Request device code
  const codeRes = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      scope: "read:user",
    }),
  });

  if (!codeRes.ok) {
    console.error(`Error: Failed to start device flow (HTTP ${codeRes.status})`);
    process.exit(1);
  }

  const codeData = await codeRes.json() as {
    device_code: string;
    user_code: string;
    verification_uri: string;
    expires_in: number;
    interval: number;
  };

  // Step 2: Display code and open browser
  console.error(`  Enter this code: ${codeData.user_code}`);
  console.error(`  URL: ${codeData.verification_uri}\n`);
  openBrowser(codeData.verification_uri);
  console.error("  Waiting for authorization...\n");

  // Step 3: Poll for token
  let interval = (codeData.interval || 5) * 1000;
  const expiresAt = Date.now() + codeData.expires_in * 1000;

  while (Date.now() < expiresAt) {
    await new Promise((r) => setTimeout(r, interval));

    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        device_code: codeData.device_code,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });

    const tokenData = await tokenRes.json() as {
      access_token?: string;
      token_type?: string;
      scope?: string;
      error?: string;
      interval?: number;
    };

    if (tokenData.access_token) {
      const store = readAuthStore();
      store.github = {
        access_token: tokenData.access_token,
        token_type: tokenData.token_type || "bearer",
        scope: tokenData.scope || "",
        created_at: Date.now(),
      };
      writeAuthStore(store);
      console.error("  Logged in to GitHub successfully!\n");
      return;
    }

    switch (tokenData.error) {
      case "authorization_pending":
        continue;
      case "slow_down":
        interval = ((tokenData.interval || codeData.interval + 5) * 1000);
        continue;
      case "expired_token":
        console.error("  Error: Device code expired. Please try again.");
        process.exit(1);
        break;
      case "access_denied":
        console.error("  Error: Authorization was denied.");
        process.exit(1);
        break;
      default:
        console.error(`  Error: ${tokenData.error || "Unknown error"}`);
        process.exit(1);
    }
  }

  console.error("  Error: Timed out waiting for authorization.");
  process.exit(1);
}

// --- Token Retrieval ---

export function getOAuthToken(providerType: string): string | undefined {
  const store = readAuthStore();

  if (providerType === "GitHub") {
    return store.github?.access_token;
  }

  return undefined;
}
