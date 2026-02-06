import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import ModelClient, { isUnexpected } from '@azure-rest/ai-inference';
import { AzureKeyCredential } from '@azure/core-auth';
import { execSync } from "child_process";
import readline from "readline";
import os from "os";
import fs from "fs";
import path from "path";
import envPaths from "env-paths";

import { DEFAULT_CONTEXT_CONFIG, buildContextHistory } from "./context";
import type { ContextConfig } from "./context";

type ProviderType = "OpenAI" | "Custom" | "Claude" | "Gemini" | "GitHub" | "ClaudeCode";

interface Config {
  type: ProviderType;
  apiKey?: string;
  model: string;
  baseURL?: string;
  context?: ContextConfig;
  clipboard?: boolean;
}

interface ParsedArgs {
  help: boolean;
  version: boolean;
  dryRun: boolean;
  exec: boolean;
  explain: boolean;
  raw: boolean;
  verbose: boolean;
  copy: boolean | undefined;
  history: boolean | undefined;
  provider: string | undefined;
  model: string | undefined;
  apiKey: string | undefined;
  baseUrl: string | undefined;
  historyCount: number | undefined;
  retry: number | undefined;
  subcommand: string | undefined;
  subcommandArgs: string[];
  description: string;
}

const PROVIDER_ALIASES: Record<string, ProviderType> = {
  openai: "OpenAI",
  custom: "Custom",
  claude: "Claude",
  gemini: "Gemini",
  github: "GitHub",
  claudecode: "ClaudeCode",
};

function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = {
    help: false,
    version: false,
    dryRun: false,
    exec: false,
    explain: false,
    raw: false,
    verbose: false,
    copy: undefined,
    history: undefined,
    provider: undefined,
    model: undefined,
    apiKey: undefined,
    baseUrl: undefined,
    historyCount: undefined,
    retry: undefined,
    subcommand: undefined,
    subcommandArgs: [],
    description: "",
  };

  // Check for subcommands first (before flag parsing)
  if (argv[0] === "config") {
    result.subcommand = "config";
    result.subcommandArgs = argv.slice(1);
    return result;
  }
  if (argv[0] === "setup") {
    result.subcommand = "setup";
    result.subcommandArgs = argv.slice(1);
    return result;
  }

  const descriptionParts: string[] = [];
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i]!;

    // -- terminator: everything after is description
    if (arg === "--") {
      descriptionParts.push(...argv.slice(i + 1));
      break;
    }

    // Long flags
    switch (arg) {
      case "--help": result.help = true; i++; continue;
      case "--version": result.version = true; i++; continue;
      case "--dry-run": result.dryRun = true; i++; continue;
      case "--exec": result.exec = true; i++; continue;
      case "--explain": result.explain = true; i++; continue;
      case "--raw": result.raw = true; i++; continue;
      case "--verbose": result.verbose = true; i++; continue;
      case "--copy": result.copy = true; i++; continue;
      case "--no-copy": result.copy = false; i++; continue;
      case "--history": result.history = true; i++; continue;
      case "--no-history": result.history = false; i++; continue;
      case "--provider": result.provider = argv[++i]; i++; continue;
      case "--model": result.model = argv[++i]; i++; continue;
      case "--api-key": result.apiKey = argv[++i]; i++; continue;
      case "--base-url": result.baseUrl = argv[++i]; i++; continue;
      case "--history-count": {
        const val = argv[++i];
        result.historyCount = val ? parseInt(val, 10) : undefined;
        result.history = true;
        i++; continue;
      }
      case "--retry": {
        const val = argv[++i];
        result.retry = val ? parseInt(val, 10) : undefined;
        i++; continue;
      }
    }

    // Short flags
    if (arg.startsWith("-") && !arg.startsWith("--") && arg.length >= 2) {
      let consumed = false;
      // Short flags with values
      switch (arg) {
        case "-p": result.provider = argv[++i]; i++; consumed = true; break;
        case "-m": result.model = argv[++i]; i++; consumed = true; break;
        case "-k": result.apiKey = argv[++i]; i++; consumed = true; break;
      }
      if (consumed) continue;

      // Short boolean flags (can be combined: -nxe)
      const chars = arg.slice(1);
      let allValid = true;
      for (const ch of chars) {
        switch (ch) {
          case "h": result.help = true; break;
          case "v": result.version = true; break;
          case "n": result.dryRun = true; break;
          case "x": result.exec = true; break;
          case "e": result.explain = true; break;
          case "r": result.raw = true; break;
          case "V": result.verbose = true; break;
          case "c": result.copy = true; break;
          default: allValid = false; break;
        }
      }
      if (allValid) { i++; continue; }
    }

    // Not a flag — part of description
    descriptionParts.push(arg);
    i++;
  }

  result.description = descriptionParts.join(" ").trim();
  return result;
}

const CLAUDE_MAX_TOKENS = 1024;

const DEFAULT_CONFIG: Config = {
  type: "OpenAI",
  model: "gpt-4.1",
  context: DEFAULT_CONTEXT_CONFIG,
  clipboard: false,
};

function getEnvApiKey(type: ProviderType): string | undefined {
  switch (type) {
    case "Claude": return process.env.ANTHROPIC_API_KEY;
    case "Gemini": return process.env.GOOGLE_API_KEY;
    case "GitHub": return process.env.GITHUB_TOKEN;
    case "ClaudeCode": return undefined;
    case "OpenAI":
    case "Custom":
    default: return process.env.OPENAI_API_KEY;
  }
}

function getConfig(): Config {
  const paths = envPaths("owo", { suffix: "" });
  const configPath = path.join(paths.config, "config.json");

  if (!fs.existsSync(configPath)) {
    try {
      // If the config file doesn't exist, create it with defaults.
      fs.mkdirSync(paths.config, { recursive: true });
      const defaultConfigToFile = {
        ...DEFAULT_CONFIG,
        apiKey: "",
        baseURL: null,
        clipboard: false,
      };
      fs.writeFileSync(
        configPath,
        JSON.stringify(defaultConfigToFile, null, 2)
      );

      // For this first run, use the environment variable for the API key.
      // The newly created file has an empty key, so subsequent runs will also fall back to the env var until the user edits the file.
      return {
        ...DEFAULT_CONFIG,
        apiKey: getEnvApiKey(DEFAULT_CONFIG.type),
      };
    } catch (error) {
      console.error("Error creating the configuration file at:", configPath);
      console.error("Please check your permissions for the directory.");
      process.exit(1);
    }
  }

  try {
    const rawConfig = fs.readFileSync(configPath, "utf-8");
    const userConfig = JSON.parse(rawConfig);

    // Merge user config with defaults, and also check env for API key as a fallback.
    const providerType = userConfig.type || DEFAULT_CONFIG.type;
    const mergedConfig = {
      ...DEFAULT_CONFIG,
      ...userConfig,
      apiKey: userConfig.apiKey || getEnvApiKey(providerType),
    };

    // Ensure context config has all defaults filled in
    if (mergedConfig.context) {
      mergedConfig.context = {
        ...DEFAULT_CONTEXT_CONFIG,
        ...mergedConfig.context,
      };
    } else {
      mergedConfig.context = DEFAULT_CONTEXT_CONFIG;
    }

    // Ensure clipboard config has default
    if (mergedConfig.clipboard === undefined) {
      mergedConfig.clipboard = false;
    }

    validateConfig(mergedConfig);
    return mergedConfig;
  } catch (error) {
    console.error(
      "Error reading or parsing the configuration file at:",
      configPath
    );
    console.error("Please ensure it is a valid JSON file.");
    process.exit(1);
  }
}

const VALID_PROVIDERS: ProviderType[] = ["OpenAI", "Custom", "Claude", "Gemini", "GitHub", "ClaudeCode"];

function validateConfig(config: Config): void {
  if (!VALID_PROVIDERS.includes(config.type)) {
    console.error(`Error: Invalid provider type "${config.type}".`);
    console.error(`Valid types: ${VALID_PROVIDERS.join(", ")}`);
    process.exit(1);
  }

  if (!config.model && config.type !== "GitHub") {
    console.error(`Error: "model" is required in config.json for provider "${config.type}".`);
    process.exit(1);
  }

  if (config.type === "Custom" && !config.baseURL) {
    console.error('Error: "baseURL" is required in config.json when using the "Custom" provider.');
    process.exit(1);
  }

  if (config.context?.maxHistoryCommands !== undefined) {
    const max = config.context.maxHistoryCommands;
    if (typeof max !== "number" || max <= 0 || !Number.isInteger(max)) {
      console.error('Error: "context.maxHistoryCommands" must be a positive integer.');
      process.exit(1);
    }
  }
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const status = error?.status ?? error?.statusCode ?? error?.code;
      const isRetryable = status === 429 || (typeof status === "number" && status >= 500);
      if (!isRetryable || attempt >= retries) throw error;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
}

async function copyToClipboard(text: string): Promise<void> {
  try {
    if (process.platform === "darwin") {
      execSync("pbcopy", { input: text });
    } else if (process.platform === "win32") {
      execSync("clip", { input: text });
    } else {
      // Linux - try xclip first, then xsel
      try {
        execSync("xclip -selection clipboard", { input: text });
      } catch {
        execSync("xsel --clipboard --input", { input: text });
      }
    }
  } catch (error) {
    throw new Error(`Clipboard operation failed: ${error}`);
  }
}

const VERSION = "1.3.0";

function printHelp(): void {
  console.log(`owo v${VERSION} - Natural language to shell commands using AI

Usage:
  owo <command description>    Generate a shell command from a description
  owo setup                    Interactive first-run configuration wizard
  owo config path              Print config file location
  owo config show              Display current config (API keys masked)
  owo config set <key> <value> Set a config value

Provider Overrides:
  -p, --provider <type>      Override provider (openai, claude, gemini, github, claudecode, custom)
  -m, --model <name>         Override model
  -k, --api-key <key>        Override API key
      --base-url <url>       Override base URL (custom providers)

Behavior:
  -c, --copy                 Copy command to clipboard
      --no-copy              Don't copy to clipboard
      --history              Include shell history context
      --no-history           Exclude shell history context
      --history-count <n>    History commands to include (implies --history)

Output:
  -x, --exec                 Execute generated command (with confirmation)
  -e, --explain              Show command explanation on stderr
  -r, --raw                  Suppress all non-command output

Debugging:
  -n, --dry-run              Show prompt without making API call
  -V, --verbose              Show diagnostics (provider, latency, tokens)
      --retry <n>            Override retry count (default: 2)

General:
  -h, --help                 Show this help message
  -v, --version              Show version number

Use -- to separate flags from description:
  owo -- -rf delete these files

Examples:
  owo list all files larger than 100MB
  owo -p claude -m claude-sonnet-4-20250514 find large log files
  owo --dry-run find files modified today
  owo --copy find all zombie processes
  owo -x delete all .tmp files older than 7 days
  echo "find large files" | owo

Providers: OpenAI, Custom, Claude, Gemini, GitHub, ClaudeCode

Config file location varies by platform:
  Linux:   ~/.config/owo/config.json
  macOS:   ~/Library/Preferences/owo/config.json
  Windows: %APPDATA%\\owo\\config.json`);
}

function handleConfigSubcommand(args: string[]): void {
  const paths = envPaths("owo", { suffix: "" });
  const configPath = path.join(paths.config, "config.json");

  const sub = args[0];

  if (sub === "path") {
    console.log(configPath);
    process.exit(0);
  }

  if (sub === "show") {
    if (!fs.existsSync(configPath)) {
      console.error("No config file found. Run `owo` once to create a default config.");
      process.exit(1);
    }
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    // Mask API key
    if (raw.apiKey) {
      const key = String(raw.apiKey);
      raw.apiKey = key.length > 8
        ? key.slice(0, 4) + "..." + key.slice(-4)
        : "****";
    }
    console.log(JSON.stringify(raw, null, 2));
    process.exit(0);
  }

  if (sub === "set") {
    const key = args[1];
    const value = args[2];
    if (!key || value === undefined) {
      console.error("Usage: owo config set <key> <value>");
      process.exit(1);
    }

    let existing: Record<string, any> = {};
    if (fs.existsSync(configPath)) {
      existing = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } else {
      fs.mkdirSync(paths.config, { recursive: true });
    }

    // Parse booleans and numbers
    let parsed: any = value;
    if (value === "true") parsed = true;
    else if (value === "false") parsed = false;
    else if (!isNaN(Number(value)) && value !== "") parsed = Number(value);

    existing[key] = parsed;
    fs.writeFileSync(configPath, JSON.stringify(existing, null, 2));
    console.log(`Set ${key} = ${JSON.stringify(parsed)}`);
    process.exit(0);
  }

  console.error(`Unknown config subcommand: ${sub}`);
  console.error("Usage: owo config <path|show|set>");
  process.exit(1);
}

function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });
}

function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

const DEFAULT_MODELS: Record<ProviderType, string> = {
  OpenAI: "gpt-4.1",
  Custom: "llama3",
  Claude: "claude-sonnet-4-20250514",
  Gemini: "gemini-pro",
  GitHub: "openai/gpt-4.1-nano",
  ClaudeCode: "sonnet",
};

async function handleSetupSubcommand(): Promise<void> {
  const rl = createReadlineInterface();

  console.error("\nowo setup - Interactive Configuration Wizard\n");

  // 1. Pick provider
  const providers: ProviderType[] = ["OpenAI", "Claude", "Gemini", "GitHub", "ClaudeCode", "Custom"];
  console.error("Available providers:");
  providers.forEach((p, i) => console.error(`  ${i + 1}. ${p}`));

  let providerIdx: number;
  while (true) {
    const answer = await prompt(rl, `\nSelect provider [1-${providers.length}]: `);
    providerIdx = parseInt(answer, 10) - 1;
    if (providerIdx >= 0 && providerIdx < providers.length) break;
    console.error("Invalid selection. Please enter a number.");
  }
  const providerType = providers[providerIdx]!;

  // 2. API key
  let apiKey = "";
  if (providerType !== "ClaudeCode") {
    const envVar = {
      OpenAI: "OPENAI_API_KEY", Custom: "OPENAI_API_KEY",
      Claude: "ANTHROPIC_API_KEY", Gemini: "GOOGLE_API_KEY",
      GitHub: "GITHUB_TOKEN",
    }[providerType] || "OPENAI_API_KEY";

    apiKey = await prompt(rl, `\nAPI key (or press Enter to use $${envVar}): `);
  }

  // 3. Model
  const defaultModel = DEFAULT_MODELS[providerType];
  const modelAnswer = await prompt(rl, `\nModel [${defaultModel}]: `);
  const model = modelAnswer.trim() || defaultModel;

  // 4. Base URL for Custom
  let baseURL: string | undefined;
  if (providerType === "Custom") {
    const urlAnswer = await prompt(rl, "\nBase URL (e.g., http://localhost:11434/v1): ");
    baseURL = urlAnswer.trim() || undefined;
  }

  // 5. Clipboard
  const clipAnswer = await prompt(rl, "\nAuto-copy commands to clipboard? [y/N]: ");
  const clipboard = clipAnswer.trim().toLowerCase() === "y";

  // 6. History
  const histAnswer = await prompt(rl, "Include shell history context? [y/N]: ");
  const historyEnabled = histAnswer.trim().toLowerCase() === "y";

  rl.close();

  // Build config
  const newConfig: Record<string, any> = {
    type: providerType,
    apiKey: apiKey,
    model: model,
    clipboard: clipboard,
    context: {
      enabled: historyEnabled,
      maxHistoryCommands: 10,
    },
  };
  if (baseURL) newConfig.baseURL = baseURL;

  // Write config
  const paths = envPaths("owo", { suffix: "" });
  const configPath = path.join(paths.config, "config.json");
  fs.mkdirSync(paths.config, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));

  console.error(`\nConfiguration saved to: ${configPath}`);
  console.error("You're all set! Try: owo list all files larger than 100MB\n");
  process.exit(0);
}

// --- Argument Parsing ---
const rawArgs = process.argv.slice(2);
const parsed = parseArgs(rawArgs);

if (parsed.help) {
  printHelp();
  process.exit(0);
}

if (parsed.version) {
  console.log(VERSION);
  process.exit(0);
}

if (parsed.subcommand === "config") {
  handleConfigSubcommand(parsed.subcommandArgs);
}

if (parsed.subcommand === "setup") {
  await handleSetupSubcommand();
}

// Read from stdin if piped
let commandDescription = parsed.description;
if (!commandDescription && !process.stdin.isTTY) {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  commandDescription = Buffer.concat(chunks).toString("utf-8").trim();
}

const config = getConfig();

// Apply CLI overrides to config
if (parsed.provider) {
  const normalized = parsed.provider.toLowerCase();
  const mapped = PROVIDER_ALIASES[normalized];
  if (!mapped) {
    console.error(`Error: Unknown provider "${parsed.provider}".`);
    console.error(`Valid providers: ${Object.keys(PROVIDER_ALIASES).join(", ")}`);
    process.exit(1);
  }
  config.type = mapped;
}
if (parsed.model) config.model = parsed.model;
if (parsed.apiKey) config.apiKey = parsed.apiKey;
if (parsed.baseUrl) config.baseURL = parsed.baseUrl;
if (parsed.copy !== undefined) config.clipboard = parsed.copy;
if (parsed.history !== undefined) {
  if (!config.context) config.context = { ...DEFAULT_CONTEXT_CONFIG };
  config.context.enabled = parsed.history;
}
if (parsed.historyCount !== undefined) {
  if (!config.context) config.context = { ...DEFAULT_CONTEXT_CONFIG };
  config.context.maxHistoryCommands = parsed.historyCount;
}

// Re-resolve API key after provider override (flag > config > env)
if (!parsed.apiKey && !config.apiKey) {
  config.apiKey = getEnvApiKey(config.type);
}

validateConfig(config);

if (!commandDescription) {
  console.error("Error: No command description provided.");
  console.error("Usage: owo <command description>");
  console.error('Run "owo --help" for more information.');
  process.exit(1);
}

function sanitizeResponse(content: string): string {
  if (!content) return "";

  content = content.replace(
    /<\s*think\b[^>]*>[\s\S]*?<\s*\/\s*think\s*>/gi,
    ""
  );

  let lastCodeBlock: string | null = null;
  const codeBlockRegex = /```(?:[^\n]*)\n([\s\S]*?)```/g;
  let m;
  while ((m = codeBlockRegex.exec(content)) !== null) {
    lastCodeBlock = m[1] || '';
  }
  if (lastCodeBlock) {
    content = lastCodeBlock;
  } else {
    content = content.replace(/`/g, "");
  }

  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return "";

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!;

    const looksLikeSentence =
      /^[A-Z][\s\S]*[.?!]$/.test(line) ||
      /\b(user|want|should|shouldn't|think|explain|error|note)\b/i.test(line);
    if (!looksLikeSentence && line.length <= 2000) {
      return line.trim();
    }
  }

  return lines.at(-1)?.trim() || '';
}

function buildPrompts(
  config: Config,
  commandDescription: string,
  explain: boolean
): { systemPrompt: string; userMessage: string } {
  const envContext = `
Operating System: ${os.type()} ${os.release()} (${os.platform()} - ${os.arch()})
Node.js Version: ${process.version}
Shell: ${process.env.SHELL || "unknown"}
Current Working Directory: ${process.cwd()}
Home Directory: ${os.homedir()}
CPU Info: ${os.cpus()[0]?.model} (${os.cpus().length} cores)
Total Memory: ${(os.totalmem() / 1024 / 1024).toFixed(0)} MB
Free Memory: ${(os.freemem() / 1024 / 1024).toFixed(0)} MB
`;

  // Get directory listing (`ls` on Unix, `dir` on Windows)
  let lsResult = "";
  let lsCommand = "";
  try {
    if (process.platform === "win32") {
      lsCommand = "dir /b";
      lsResult = execSync("cmd /c dir /b", { encoding: "utf-8" });
    } else {
      lsCommand = "ls";
      lsResult = execSync("ls", { encoding: "utf-8" });
    }
  } catch (error) {
    lsResult = "Unable to get directory listing";
  }

  // Build command history context if enabled
  const contextConfig = config.context || DEFAULT_CONTEXT_CONFIG;
  const historyContext = buildContextHistory(contextConfig);

  let systemPrompt: string;
  if (explain) {
    systemPrompt = `
You live in a developer's CLI, helping them convert natural language into CLI commands.
Based on the description of the command given, generate the command and a brief explanation.
Make sure to escape characters when appropriate. The result of \`${lsCommand}\` is given with the command.
Output your response in exactly this format:
COMMAND: <the command>
EXPLANATION: <brief explanation of what the command does>
Do not wrap the command in quotes.

--- ENVIRONMENT CONTEXT ---
${envContext}
--- END ENVIRONMENT CONTEXT ---

Result of \`${lsCommand}\` in working directory:
${lsResult}
${historyContext}`;
  } else {
    systemPrompt = `
You live in a developer's CLI, helping them convert natural language into CLI commands.
Based on the description of the command given, generate the command. Output only the command and nothing else.
Make sure to escape characters when appropriate. The result of \`${lsCommand}\` is given with the command.
This may be helpful depending on the description given. Do not include any other text in your response, except for the command.
Do not wrap the command in quotes.

--- ENVIRONMENT CONTEXT ---
${envContext}
--- END ENVIRONMENT CONTEXT ---

Result of \`${lsCommand}\` in working directory:
${lsResult}
${historyContext}`;
  }

  return { systemPrompt, userMessage: `Command description: ${commandDescription}` };
}

async function generateCommand(
  config: Config,
  commandDescription: string,
  explain: boolean
): Promise<string> {
  const { systemPrompt, userMessage } = buildPrompts(config, commandDescription, explain);

  if (config.type !== "ClaudeCode" && !config.apiKey) {
    const envVar = {
      OpenAI: "OPENAI_API_KEY", Custom: "OPENAI_API_KEY",
      Claude: "ANTHROPIC_API_KEY", Gemini: "GOOGLE_API_KEY",
      GitHub: "GITHUB_TOKEN",
    }[config.type] || "OPENAI_API_KEY";
    console.error("Error: API key not found.");
    console.error(
      `Please provide an API key in your config.json file or by setting the ${envVar} environment variable.`
    );
    process.exit(1);
  }

  switch (config.type) {
    case "OpenAI":
    case "Custom": {
      const openai = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
      });
      const response = await openai.chat.completions.create({
        model: config.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      });
      const raw = response?.choices?.[0]?.message?.content ?? "";
      return explain ? String(raw) : sanitizeResponse(String(raw));
    }

    case "Claude": {
      const anthropic = new Anthropic({ apiKey: config.apiKey });
      const response = await anthropic.messages.create({
        model: config.model,
        system: systemPrompt,
        max_tokens: CLAUDE_MAX_TOKENS,
        messages: [
          { role: "user", content: userMessage },
        ],
      });
      const firstBlock = response.content?.[0];
      const raw = (firstBlock && firstBlock.type === 'text' ? firstBlock.text : '') ?? '';
      return explain ? String(raw) : sanitizeResponse(String(raw));
    }

    case "Gemini": {
      const genAI = new GoogleGenerativeAI(config.apiKey!);
      const model = genAI.getGenerativeModel({ model: config.model });
      const fullPrompt = `${systemPrompt}\n\n${userMessage}`;
      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      const raw = await response.text();
      return explain ? String(raw) : sanitizeResponse(String(raw));
    }

    case "GitHub": {
      const endpoint = config.baseURL ? config.baseURL : "https://models.github.ai/inference";
      const model = config.model ? config.model : "openai/gpt-4.1-nano";
      const github = ModelClient(
        endpoint,
        new AzureKeyCredential(config.apiKey!)
      );

      const response = await github.path("/chat/completions").post({
        body: {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          model: model,
        },
      });

      if (isUnexpected(response)) {
        throw response.body.error;
      }

      const content = response.body.choices?.[0]?.message?.content;
      return explain ? String(content ?? "") : sanitizeResponse(String(content ?? ""));
    }

    case "ClaudeCode": {
      // Check if claude CLI is available
      try {
        execSync('claude --version', { stdio: 'pipe' });
      } catch {
        console.error("Error: Claude Code CLI not found.");
        console.error("Install it from: https://docs.anthropic.com/en/docs/claude-code");
        process.exit(1);
      }

      const args = [
        "claude", "-p",
        "--no-session-persistence",
        "--tools", '""',
        "--system-prompt", JSON.stringify(systemPrompt),
      ];

      if (config.model) {
        args.push("--model", config.model);
      }

      args.push(JSON.stringify(userMessage));

      const result = execSync(args.join(" "), {
        encoding: 'utf-8',
        timeout: 30000,
      });

      return explain ? result : sanitizeResponse(result);
    }

    default:
      console.error(
        `Error: Unknown provider type "${config.type}" in config.json.`
      );
      process.exit(1);
  }
}

// --- Dry Run ---
if (parsed.dryRun) {
  const { systemPrompt, userMessage } = buildPrompts(config, commandDescription, parsed.explain);
  console.log("--- SYSTEM PROMPT ---");
  console.log(systemPrompt);
  console.log("--- USER MESSAGE ---");
  console.log(userMessage);
  console.log("---");
  console.log(`Provider: ${config.type}`);
  console.log(`Model: ${config.model}`);
  process.exit(0);
}

// --- Main Execution ---
const retryCount = parsed.retry !== undefined ? parsed.retry : 2;

try {
  if (parsed.verbose) {
    console.error(`Provider: ${config.type}`);
    console.error(`Model: ${config.model}`);
    if (config.baseURL) console.error(`Base URL: ${config.baseURL}`);
  }

  const startTime = Date.now();
  const rawResult = await withRetry(
    () => generateCommand(config, commandDescription, parsed.explain),
    retryCount
  );
  const elapsed = Date.now() - startTime;

  // Parse explain mode output
  let command: string;
  let explanation: string | undefined;

  if (parsed.explain) {
    const commandMatch = rawResult.match(/COMMAND:\s*(.+)/);
    const explainMatch = rawResult.match(/EXPLANATION:\s*([\s\S]+)/);
    command = commandMatch ? sanitizeResponse(commandMatch[1]!) : sanitizeResponse(rawResult);
    explanation = explainMatch ? explainMatch[1]!.trim() : undefined;
  } else {
    command = rawResult;
  }

  if (parsed.verbose) {
    console.error(`Latency: ${elapsed}ms`);
  }

  // Copy to clipboard if enabled
  if (config.clipboard) {
    try {
      await copyToClipboard(command);
      if (!parsed.raw) console.error("Copied to clipboard.");
    } catch (clipboardError: any) {
      if (!parsed.raw) console.error("Warning: Failed to copy to clipboard:", clipboardError.message);
    }
  }

  // Print explanation to stderr
  if (explanation && !parsed.raw) {
    console.error(`\nExplanation: ${explanation}`);
  }

  // Output command
  console.log(command);

  // Execute mode
  if (parsed.exec) {
    const rl = createReadlineInterface();
    const answer = await prompt(rl, "\nExecute? [y/N]: ");
    rl.close();

    if (answer.trim().toLowerCase() === "y") {
      try {
        execSync(command, { stdio: "inherit" });
      } catch (execError: any) {
        process.exit(execError.status ?? 1);
      }
    }
  }
} catch (error: any) {
  if (!parsed.raw) {
    console.error(`Error generating command (provider: ${config.type}, model: ${config.model}):`, error.message);
  }
  process.exit(1);
}
