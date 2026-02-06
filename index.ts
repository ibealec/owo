import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import ModelClient, { isUnexpected } from '@azure-rest/ai-inference';
import { AzureKeyCredential } from '@azure/core-auth';
import { execSync } from "child_process";
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

const VERSION = "1.1.2";

function printHelp(): void {
  console.log(`owo v${VERSION} - Natural language to shell commands using AI

Usage:
  owo <command description>    Generate a shell command from a description
  owo config path              Print config file location
  owo config show              Display current config (API keys masked)
  owo config set <key> <value> Set a config value

Options:
  --help, -h       Show this help message
  --version, -v    Show version number

Examples:
  owo list all files larger than 100MB
  owo find and replace foo with bar in all js files
  owo compress all png files in current directory

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

// --- Argument Parsing ---
const rawArgs = process.argv.slice(2);

if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
  printHelp();
  process.exit(0);
}

if (rawArgs.includes("--version") || rawArgs.includes("-v")) {
  console.log(VERSION);
  process.exit(0);
}

if (rawArgs[0] === "config") {
  handleConfigSubcommand(rawArgs.slice(1));
}

const config = getConfig();
const commandDescription = rawArgs.join(" ").trim();

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

async function generateCommand(
  config: Config,
  commandDescription: string
): Promise<string> {
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

  // System prompt
  const systemPrompt = `
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
          {
            role: "user",
            content: `Command description: ${commandDescription}`,
          },
        ],
      });
      const raw = response?.choices?.[0]?.message?.content ?? "";
      return sanitizeResponse(String(raw));
    }

    case "Claude": {
      const anthropic = new Anthropic({ apiKey: config.apiKey });
      const response = await anthropic.messages.create({
        model: config.model,
        system: systemPrompt,
        max_tokens: CLAUDE_MAX_TOKENS,
        messages: [
          {
            role: "user",
            content: `Command description: ${commandDescription}`,
          },
        ],
      });
      const firstBlock = response.content?.[0];
      const raw = (firstBlock && firstBlock.type === 'text' ? firstBlock.text : '') ?? '';
      return sanitizeResponse(String(raw));
    }

    case "Gemini": {
      const genAI = new GoogleGenerativeAI(config.apiKey!);
      const model = genAI.getGenerativeModel({ model: config.model });
      const prompt = `${systemPrompt}\n\nCommand description: ${commandDescription}`;
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const raw = await response.text();
      return sanitizeResponse(String(raw));
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
            { role: "user", content: `Command description: ${commandDescription}` },
          ],
          model: model,
        },
      });

      if (isUnexpected(response)) {
        throw response.body.error;
      }

      const content = response.body.choices?.[0]?.message?.content;
      return sanitizeResponse(String(content ?? ""));
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

      args.push(JSON.stringify(`Command description: ${commandDescription}`));

      const result = execSync(args.join(" "), {
        encoding: 'utf-8',
        timeout: 30000,
      });

      return sanitizeResponse(result);
    }

    default:
      console.error(
        `Error: Unknown provider type "${config.type}" in config.json.`
      );
      process.exit(1);
  }
}

// --- Main Execution ---
try {
  const command = await withRetry(() => generateCommand(config, commandDescription));

  // Copy to clipboard if enabled
  if (config.clipboard) {
    try {
      await copyToClipboard(command);
    } catch (clipboardError: any) {
      console.error("Warning: Failed to copy to clipboard:", clipboardError.message);
    }
  }

  console.log(command);
} catch (error: any) {
  console.error(`Error generating command (provider: ${config.type}, model: ${config.model}):`, error.message);
  process.exit(1);
}
