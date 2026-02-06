import fs from "fs";
import path from "path";
import readline from "readline";
import { execSync } from "child_process";
import envPaths from "env-paths";

// --- Types ---

interface AuthStore {
  github?: { token: string; source: "gh-cli" | "pat" };
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

// --- gh CLI Detection ---

function getGhCliToken(): string | undefined {
  try {
    const token = execSync("gh auth token", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return token || undefined;
  } catch {
    return undefined;
  }
}

function isGhCliInstalled(): boolean {
  try {
    execSync("gh --version", { stdio: ["pipe", "pipe", "pipe"] });
    return true;
  } catch {
    return false;
  }
}

// --- Login Flow ---

export async function loginGitHub(): Promise<void> {
  console.error("\nGitHub Login\n");

  // Option A: Try gh CLI
  if (isGhCliInstalled()) {
    const existingToken = getGhCliToken();
    if (existingToken) {
      console.error("  Found existing GitHub CLI authentication.");
      console.error("  Using token from `gh auth token`.\n");
      const store = readAuthStore();
      store.github = { token: existingToken, source: "gh-cli" };
      writeAuthStore(store);
      console.error("  Logged in via GitHub CLI successfully!\n");
      return;
    }

    // gh is installed but not authenticated — run gh auth login
    console.error("  GitHub CLI found but not authenticated.");
    console.error("  Running `gh auth login`...\n");
    try {
      execSync("gh auth login", { stdio: "inherit" });
      const token = getGhCliToken();
      if (token) {
        const store = readAuthStore();
        store.github = { token, source: "gh-cli" };
        writeAuthStore(store);
        console.error("\n  Logged in via GitHub CLI successfully!\n");
        return;
      }
    } catch {
      console.error("\n  GitHub CLI login failed or was cancelled.\n");
    }
  }

  // Option C: PAT walkthrough
  console.error("  GitHub CLI (gh) not found. Falling back to Personal Access Token.\n");
  console.error("  To create a token:");
  console.error("    1. Visit: https://github.com/settings/personal-access-tokens/new");
  console.error("    2. Give it a name (e.g., \"owo-cli\")");
  console.error("    3. Under \"Permissions\", enable: Models → Read");
  console.error("    4. Click \"Generate token\" and paste it below\n");
  openBrowser("https://github.com/settings/personal-access-tokens/new");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });

  const token = await new Promise<string>((resolve) => {
    rl.question("  Paste your token: ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

  if (!token) {
    console.error("  No token provided. Aborting.");
    process.exit(1);
  }

  const store = readAuthStore();
  store.github = { token, source: "pat" };
  writeAuthStore(store);
  console.error("\n  Token saved successfully!\n");
}

// --- Token Retrieval ---

export function getOAuthToken(providerType: string): string | undefined {
  if (providerType !== "GitHub") return undefined;

  const store = readAuthStore();

  // If stored token exists, use it
  if (store.github?.token) {
    // If source is gh-cli, refresh in case user re-authenticated
    if (store.github.source === "gh-cli") {
      const fresh = getGhCliToken();
      if (fresh) return fresh;
    }
    return store.github.token;
  }

  // No stored token — try gh CLI as a silent fallback
  return getGhCliToken();
}
