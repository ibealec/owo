import readline from "readline";

// ANSI escape codes
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const GRAY = "\x1b[90m";

export type InteractiveResult =
  | { action: "run"; command: string }
  | { action: "cancel" }
  | { action: "revise"; feedback: string };

/**
 * Returns the number of terminal rows a string occupies,
 * accounting for line wrapping based on terminal width.
 */
function terminalLines(text: string): number {
  const cols = process.stderr.columns || 80;
  if (text.length === 0) return 1;
  return Math.ceil(text.length / cols);
}

/**
 * Calculate total display lines for the interactive prompt:
 *   blank line + command line(s) + blank line + hint line
 */
function getDisplayLineCount(command: string): number {
  const commandText = `  $ ${command}`;
  return 1 + terminalLines(commandText) + 1 + 1;
}

function clearLines(count: number): void {
  process.stderr.write(`\x1b[${count}A\x1b[J`);
}

/**
 * Show the command and hint bar, returning the number of lines used.
 */
function showCommandDisplay(command: string): number {
  const display =
    `\n${DIM}  $ ${command}${RESET}\n` +
    `\n  ${GRAY}enter${RESET} run  ${GRAY}←→${RESET} edit  ${GRAY}n${RESET} revise  ${GRAY}esc${RESET} cancel\n`;
  process.stderr.write(display);
  return getDisplayLineCount(command);
}

/**
 * Present the generated command interactively.
 * Returns the user's chosen action.
 */
export async function interactivePrompt(
  command: string
): Promise<InteractiveResult> {
  const lines = showCommandDisplay(command);
  return waitForAction(command, lines);
}

function waitForAction(
  command: string,
  displayLines: number
): Promise<InteractiveResult> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      resolve({ action: "run", command });
      return;
    }

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    const handler = (data: string) => {
      // Enter → run
      if (data === "\r" || data === "\n") {
        cleanup();
        clearLines(displayLines);
        resolve({ action: "run", command });
        return;
      }

      // Bare Escape → cancel
      if (data === "\x1b") {
        cleanup();
        clearLines(displayLines);
        resolve({ action: "cancel" });
        return;
      }

      // Ctrl+C → cancel
      if (data === "\x03") {
        cleanup();
        clearLines(displayLines);
        resolve({ action: "cancel" });
        return;
      }

      // 'n' / 'N' → revise
      if (data === "n" || data === "N") {
        cleanup();
        clearLines(displayLines);
        askForFeedback().then((feedback) => {
          if (feedback) {
            resolve({ action: "revise", feedback });
          } else {
            // User cancelled feedback — re-show prompt
            const newLines = showCommandDisplay(command);
            waitForAction(command, newLines).then(resolve);
          }
        });
        return;
      }

      // Arrow keys (escape sequences) or 'e'/'E' → edit
      if (data.startsWith("\x1b[") || data === "e" || data === "E") {
        cleanup();
        clearLines(displayLines);
        editCommand(command).then((edited) => {
          if (edited !== null && edited.trim()) {
            resolve({ action: "run", command: edited.trim() });
          } else {
            resolve({ action: "cancel" });
          }
        });
        return;
      }

      // Any other key → ignore
    };

    const cleanup = () => {
      process.stdin.removeListener("data", handler);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdin.pause();
    };

    process.stdin.on("data", handler);
  });
}

function editCommand(command: string): Promise<string | null> {
  return new Promise((resolve) => {
    let resolved = false;

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr,
      prompt: `  ${DIM}$${RESET} `,
    });

    rl.prompt();
    rl.write(command);

    rl.on("line", (line) => {
      if (!resolved) {
        resolved = true;
        rl.close();
        resolve(line);
      }
    });

    rl.on("close", () => {
      if (!resolved) {
        resolved = true;
        resolve(null);
      }
    });
  });
}

function askForFeedback(): Promise<string | null> {
  return new Promise((resolve) => {
    let resolved = false;

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr,
    });

    rl.question(`  ${GRAY}revise:${RESET} `, (answer) => {
      if (!resolved) {
        resolved = true;
        rl.close();
        resolve(answer.trim() || null);
      }
    });

    rl.on("close", () => {
      if (!resolved) {
        resolved = true;
        resolve(null);
      }
    });
  });
}
