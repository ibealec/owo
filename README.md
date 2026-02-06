<h1 align="center">
  owo
</h1>

<h4 align="center">Natural language to shell commands using AI — a supercharged <a href="https://github.com/context-labs/uwu">uwu</a></h4>

<p align="center">
  <a href="https://www.npmjs.com/package/owo-cli">
    <img alt="npm version" src="https://img.shields.io/npm/v/owo-cli.svg" />
  </a>
  <a href="https://github.com/ibealec/owo/releases/latest">
    <img alt="GitHub Release" src="https://img.shields.io/github/v/release/ibealec/owo" />
  </a>
  <a href="https://opensource.org/licenses/MIT">
    <img alt="License" src="https://img.shields.io/badge/License-MIT-yellow.svg" />
  </a>
  <a href="https://github.com/ibealec/owo">
    <img alt="GitHub" src="https://img.shields.io/github/stars/ibealec/owo?style=social" />
  </a>

</p>

<p align="center">
  <a href="#what-is-this">What is this?</a> •
  <a href="#quick-examples">Quick Examples</a> •
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#contributing">Contributing</a>
</p>

## What is this?

`owo` is a lightweight, focused CLI tool that converts natural language into shell commands using Large Language Models (LLMs) like GPT-5. Unlike comprehensive agentic development tools like [Claude Code](https://www.anthropic.com/claude-code) or [Cursor](https://cursor.com), `owo` has a simple, singular purpose: **helping you write shell commands faster, without switching context**.

`owo` is not a replacement for comprehensive agentic development tools -- it is simple tool that excels at one thing. Consider it the terminal equivalent of quickly searching "how do I..." and getting an immediately runnable answer.

![owo demo](https://raw.githubusercontent.com/ibealec/owo/main/assets/uwu.gif)

After a response is generated, you can edit it before pressing enter to execute the command. This is useful if you want to add flags, or other modifications to the command.

## Quick Examples

```bash
owo find all files larger than 100MB
owo kill the process on port 3000
owo show disk usage sorted by size
owo compress this directory into a tar.gz
```

No memorizing flags, no searching Stack Overflow -- just describe what you want.

## Features

- **6 AI providers** -- OpenAI, Claude, Gemini, GitHub Models, local models (Ollama/LM Studio), and Claude Code
- **Context-aware** -- automatically includes your OS, shell, working directory, and recent commands
- **Edit before executing** -- review and modify generated commands before running them
- **Shell history integration** -- executed commands are saved to your shell history like any other command
- **Clipboard support** -- optionally copy generated commands to your clipboard
- **Explain mode** -- use the `-e` flag to get a plain-English explanation of any generated command
- **Cross-platform** -- works on macOS, Linux, and Windows

## Installation

### Option A: npm (Recommended)

Requires [Node.js](https://nodejs.org) 18+.

```bash
npm install -g owo-cli
```

### Option B: Homebrew (macOS / Linux)

```bash
brew install ibealec/owo/owo-cli
```

### Option C: Build from source

Requires [Bun](https://bun.sh).

```bash
git clone https://github.com/ibealec/owo.git
cd owo
bun install
bun run build
chmod +x dist/owo
mv dist/owo /usr/local/bin/owo
```

### Quick Start

The fastest way to get started is with the interactive setup wizard:

```bash
owo setup
```

This walks you through picking a provider, entering your API key, choosing a model, and enabling optional features. It writes the config file for you.

Alternatively, you can skip setup entirely with inline flags:

```bash
owo -p openai -k sk-your-key -m gpt-4.1 list all files larger than 100MB
```

### Configuration

`owo` is configured through a single `config.json` file. The first time you run `owo`, it will automatically create a default configuration file to get you started.

#### Configuration File Location

The `config.json` file is located in a standard, platform-specific directory:

- **Linux:** `~/.config/owo/config.json`
- **macOS:** `~/Library/Preferences/owo/config.json`
- **Windows:** `%APPDATA%\\owo\\config.json` (e.g., `C:\\Users\\<user>\\AppData\\Roaming\\owo\\config.json`)

#### Provider Types

You can configure `owo` to use different AI providers by setting the `type` field in your `config.json`. The supported types are `"OpenAI"`, `"Custom"`, `"Claude"`, `"Gemini"`, `"GitHub"`, and `"ClaudeCode"`.

Below are examples for each provider type.

---

##### **1. OpenAI (`type: "OpenAI"`)**

This is the default configuration.

```json
{
  "type": "OpenAI",
  "apiKey": "sk-your_openai_api_key",
  "model": "gpt-4.1"
}
```

- `apiKey`: Your OpenAI API key. If empty, `owo` will fall back to the `OPENAI_API_KEY` environment variable.

---

##### **2. Claude (`type: "Claude"`)**

Uses the native Anthropic API.

```json
{
  "type": "Claude",
  "apiKey": "your-anthropic-api-key",
  "model": "claude-3-opus-20240229"
}
```

- `apiKey`: Your Anthropic API key. If empty, `owo` will fall back to the `ANTHROPIC_API_KEY` environment variable.

---

##### **3. Gemini (`type: "Gemini"`)**

Uses the native Google Gemini API.

```json
{
  "type": "Gemini",
  "apiKey": "your-google-api-key",
  "model": "gemini-pro"
}
```

- `apiKey`: Your Google AI Studio API key. If empty, `owo` will fall back to the `GOOGLE_API_KEY` environment variable.

---

##### **4. GitHub (`type: "GitHub"`)**
Uses multiple free to use GitHub models.
```json
{
  "type": "GitHub",
  "apiKey": "your-github-token",
  "model": "openai/gpt-4.1-nano"
}
```

- `apiKey`: Your GitHub token. If empty, `owo` will fall back to the `GITHUB_TOKEN` environment variable.

---

##### **5. Claude Code (`type: "ClaudeCode"`)**

Uses the locally installed [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI. No API key needed -- Claude Code handles its own authentication.

```json
{
  "type": "ClaudeCode",
  "model": "sonnet"
}
```

- `model`: Optional. The model to use (e.g., `"sonnet"`, `"opus"`). If omitted, Claude Code uses its default.
- **Requires**: The `claude` CLI to be installed and authenticated.

---

##### **6. Custom / Local Models (`type: "Custom"`)**

This type is for any other OpenAI-compatible API endpoint, such as Ollama, LM Studio, or a third-party proxy service.

```json
{
  "type": "Custom",
  "model": "llama3",
  "baseURL": "http://localhost:11434/v1",
  "apiKey": "ollama"
}
```

- `model`: The name of the model you want to use (e.g., `"llama3"`).
- `baseURL`: The API endpoint for the service.
- `apiKey`: An API key, if required by the service. For local models like Ollama, this can often be a non-empty placeholder like `"ollama"`.

---

#### Context Configuration (Optional)

`owo` can include recent command history from your shell to provide better context for command generation. This feature is disabled by default but can be enabled. When enabled, `owo` includes the raw last N lines from your shell history (e.g., bash, zsh, fish), preserving any extra metadata your shell records:

```json
{
  "type": "OpenAI",
  "apiKey": "sk-your_api_key",
  "model": "gpt-4.1",
  "context": {
    "enabled": true,
    "maxHistoryCommands": 10
  }
}
```

- `enabled`: Whether to include command history context (default: `false`)
- `maxHistoryCommands`: Number of recent commands to include (default: `10`)
  When enabled, `owo` automatically detects and parses history from bash, zsh, and fish shells.

##### Notes on history scanning performance

- **Chunk size unit**: When scanning shell history files, `owo` reads from the end of the file in fixed-size chunks of 64 KiB. This is not currently configurable but can be made if desired.

##### Windows notes

- **History detection**: On Windows, `owo` searches for PowerShell PSReadLine history at:
  - `%APPDATA%\Microsoft\Windows\PowerShell\PSReadLine\ConsoleHost_history.txt` (Windows PowerShell 5.x)
  - `%APPDATA%\Microsoft\PowerShell\PSReadLine\ConsoleHost_history.txt` (PowerShell 7+)
    If not found, it falls back to Unix-like history files that may exist when using Git Bash/MSYS/Cygwin (e.g., `.bash_history`, `.zsh_history`).
- **Directory listing**: On Windows, directory listing uses `dir /b`; on Linux/macOS it uses `ls`.

#### Clipboard Integration

`owo` can automatically copy generated commands to your system clipboard:

```json
{
  "type": "OpenAI",
  "apiKey": "sk-your_api_key",
  "model": "gpt-4.1",
  "clipboard": true
}
```

- `clipboard`: Whether to automatically copy generated commands to clipboard (default: `false`)

When enabled, every command generated by `owo` is automatically copied to your system clipboard, making it easy to paste commands elsewhere. The clipboard integration works cross-platform:
- **macOS**: Uses `pbcopy`
- **Windows**: Uses `clip`
- **Linux**: Uses `xclip` or `xsel` (falls back to `xsel` if `xclip` is not available)

**Note**: On Linux, you'll need either `xclip` or `xsel` installed for clipboard functionality to work.

### Shell Helper Function

This function lets you type `owo <description>` and get an editable command preloaded in your shell.

#### zsh

```zsh
# ~/.zshrc

owo() {
  local cmd
  cmd="$(owo-cli "$@")" || return
  vared -p "" -c cmd
  print -s -- "$cmd"   # add to history
  eval "$cmd"
}
```

After editing `~/.zshrc`, reload it:

```bash
source ~/.zshrc
```

#### bash
```bash
owo() {
  local cmd
  cmd="$(owo-cli "$@")" || return
  # requires interactive shell and Bash 4+
  read -e -i "$cmd" -p "" cmd || return
  builtin history -s -- "$cmd"
  eval -- "$cmd"
}
```

#### Powershell / Conhost / Windows Terminal

Note: This only applies to Windows with Powershell installed

To your Powershell profile, add this snippet

```Powershell
function owo {
    param(
        [Parameter(ValueFromRemainingArguments=$true)]
        $args
    )
    $Source = '
    using System;
    using System.Runtime.InteropServices;

    public class ConsoleInjector {
        [StructLayout(LayoutKind.Sequential)]
        public struct KEY_EVENT_RECORD {
            public bool bKeyDown;
            public ushort wRepeatCount;
            public ushort wVirtualKeyCode;
            public ushort wVirtualScanCode;
            public char UnicodeChar;
            public uint dwControlKeyState;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct INPUT_RECORD {
            public ushort EventType;
            public KEY_EVENT_RECORD KeyEvent;
        }

        [DllImport("kernel32.dll", SetLastError = true)]
        public static extern IntPtr GetStdHandle(int nStdHandle);

        [DllImport("kernel32.dll", SetLastError = true)]
        public static extern bool WriteConsoleInput(
            IntPtr hConsoleInput,
            INPUT_RECORD[] lpBuffer,
            int nLength,
            out int lpNumberOfEventsWritten
        );

        const int STD_INPUT_HANDLE = -10;
        const ushort KEY_EVENT = 0x0001;

        public static void SendCommand(string text) {
            IntPtr hIn = GetStdHandle(STD_INPUT_HANDLE);
            var records = new INPUT_RECORD[text.Length];

            int i = 0;
            for (; i < text.Length; i++) {
                records[i].EventType = KEY_EVENT;
                records[i].KeyEvent.bKeyDown = true;
                records[i].KeyEvent.wRepeatCount = 1;
                records[i].KeyEvent.UnicodeChar = text[i];
            }

            int written;
            WriteConsoleInput(hIn, records, i, out written);
        }
    }';
    $cmd = owo-cli @args;
    Add-Type -TypeDefinition $Source;
    [ConsoleInjector]::SendCommand($cmd)
}
```

This will work for Powershell terminals. To add this functionality to Conhost / Terminal, save this as `owo.bat` and let it be accessible in ```PATH``` (you must do the Powershell step as well). For example,

```Batch
:: assumes that ECHO ON and CHCP 437 is user preference
@ECHO OFF
CHCP 437 >NUL
POWERSHELL owo %*
@ECHO ON
```

## Usage

Once installed and configured:

```bash
owo generate a new ssh key called owo-key and add it to the ssh agent
```

You'll see the generated command in your shell's input line. Press **Enter** to run it, or edit it first. Executed commands will show up in your shell's history just like any other command.

### CLI Flags

All flags can override config values for a single invocation without editing `config.json`.

#### Provider Overrides

| Flag | Short | Description |
|------|-------|-------------|
| `--provider <type>` | `-p` | Override provider (`openai`, `claude`, `gemini`, `github`, `claudecode`, `custom`) |
| `--model <name>` | `-m` | Override model |
| `--api-key <key>` | `-k` | Override API key (highest precedence: flag > config > env var) |
| `--base-url <url>` | | Override base URL for custom/OpenAI-compatible providers |

```bash
# Use Claude for a single query without changing config
owo -p claude -m claude-sonnet-4-20250514 find large log files

# Use a local Ollama model
owo -p custom --base-url http://localhost:11434/v1 -m llama3 show disk usage
```

#### Behavior

| Flag | Short | Description |
|------|-------|-------------|
| `--copy` | `-c` | Copy generated command to clipboard |
| `--no-copy` | | Don't copy to clipboard |
| `--history` | | Include shell history context |
| `--no-history` | | Exclude shell history context |
| `--history-count <n>` | | Number of history commands to include (implies `--history`) |

```bash
# Copy command even if config has clipboard disabled
owo --copy find all zombie processes

# Use history context for a single query
owo --history redo that but with sudo
```

#### Output

| Flag | Short | Description |
|------|-------|-------------|
| `--exec` | `-x` | Execute the generated command after `Execute? [y/N]` confirmation |
| `--explain` | `-e` | Show a brief explanation of the command on stderr |
| `--raw` | `-r` | Suppress all non-command output (clean for piping) |

```bash
# Execute with confirmation
owo -x delete all .tmp files older than 7 days

# Get an explanation alongside the command
owo -e find all files larger than 100mb

# Pipe-safe output
result=$(owo -r show my public IP)
```

#### Debugging

| Flag | Short | Description |
|------|-------|-------------|
| `--dry-run` | `-n` | Print the prompt that would be sent without making an API call |
| `--verbose` | `-V` | Print diagnostics (provider, model, latency) to stderr |
| `--retry <n>` | | Override retry count (default: 2) |

```bash
# See exactly what would be sent to the API
owo --dry-run find large files

# Debug with full diagnostics
owo -V convert all heic files to jpg

# Fail fast with no retries
owo --retry 0 list disk usage
```

#### Stdin / Pipe Support

`owo` auto-detects piped input and reads the description from stdin:

```bash
echo "find files larger than 100mb" | owo
```

#### The `--` Separator

Use `--` to separate flags from the description when your description looks like a flag:

```bash
owo -- -rf delete these files
```

## License

[MIT](LICENSE)

## Contributing

Contributions are welcome! The codebase is written in TypeScript and built with [Bun](https://bun.sh).

To get started locally:

```bash
git clone https://github.com/ibealec/owo.git
cd owo
bun install
bun run dev
```

If you find a bug, have a feature request, or want to improve the docs, please [open an issue](https://github.com/ibealec/owo/issues) or submit a pull request. All contributions -- big or small -- are appreciated.
