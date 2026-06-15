// Agent tool definitions + execution against a repl pod.
//
// Each tool maps to a PodControl capability. File mutations flow through the
// pod's normal write/patch messages → broadcast to all clients → live sync.

import type { AgentTool } from "./ai-providers/types";
import type { PodControl, FileNode } from "./pod-control.service";

export const AGENT_TOOLS: AgentTool[] = [
  {
    name: "list_files",
    description:
      "List every file in the workspace as a tree. Call this first to understand the project layout before reading or editing.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "read_file",
    description:
      "Read the full contents of a file. ALWAYS read a file before editing it so your `search` text matches exactly.",
    parameters: {
      type: "object",
      properties: { path: { type: "string", description: "Workspace-relative file path" } },
      required: ["path"],
    },
  },
  {
    name: "grep",
    description:
      "Search the workspace for a regex pattern. Use to locate symbols, usages, or text across files before editing.",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Regex pattern to search for" },
        path: { type: "string", description: "Optional path/dir to limit the search (default: whole workspace)" },
      },
      required: ["pattern"],
    },
  },
  {
    name: "glob",
    description:
      "Find files by name pattern (e.g. `*.ts`, `*.test.tsx`, `package.json`). Faster than grep for locating files by name. Returns matching paths.",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Filename glob, e.g. *.ts or Button.tsx (matches the file name in any directory)" },
        path: { type: "string", description: "Optional directory to search under (default: whole workspace)" },
      },
      required: ["pattern"],
    },
  },
  {
    name: "web_fetch",
    description:
      "Fetch the text content of an http(s) URL (e.g. library docs, an API reference, a spec). Returns the page text, truncated. Use to check current/external info instead of guessing.",
    parameters: {
      type: "object",
      properties: { url: { type: "string", description: "Absolute http(s) URL" } },
      required: ["url"],
    },
  },
  {
    name: "ask_user_question",
    description:
      "Ask the user a multiple-choice question when you are blocked on a decision only they can make (which approach, which library, an ambiguous requirement). Don't use it for things you can decide yourself or find in the code. Execution pauses until they answer.",
    parameters: {
      type: "object",
      properties: {
        question: { type: "string", description: "The question to ask" },
        header: { type: "string", description: "Very short label (≤12 chars), e.g. 'Auth method'" },
        options: {
          type: "array",
          description: "2–4 distinct choices. The user can also type their own answer.",
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "Short choice label" },
              description: { type: "string", description: "What this choice means / its tradeoff" },
            },
            required: ["label", "description"],
          },
        },
        multiSelect: { type: "boolean", description: "Allow selecting multiple options" },
      },
      required: ["question", "options"],
    },
  },
  {
    name: "todo_write",
    description:
      "Record or update your task plan as a checklist. Use for any task with 3+ steps: list the steps, mark exactly one in_progress, mark each completed as you finish it. Helps you stay on track and shows the user your progress.",
    parameters: {
      type: "object",
      properties: {
        todos: {
          type: "array",
          description: "The full current todo list (replaces the previous one).",
          items: {
            type: "object",
            properties: {
              content: { type: "string", description: "The task, imperative (e.g. 'Add auth middleware')" },
              status: { type: "string", enum: ["pending", "in_progress", "completed"] },
            },
            required: ["content", "status"],
          },
        },
      },
      required: ["todos"],
    },
  },
  {
    name: "spawn_subagent",
    description:
      "Delegate a scoped subtask to a specialized subagent that runs its own loop and returns ONE summary (its intermediate steps stay out of your context). Types: 'explore' = fast read-only codebase research; 'verify' = adversarially test that a change works (runs commands/tests, cannot modify files). Give a complete, self-contained prompt — the subagent has no other context.",
    parameters: {
      type: "object",
      properties: {
        subagent_type: { type: "string", enum: ["explore", "verify"], description: "explore (read-only research) or verify (adversarial test)" },
        prompt: { type: "string", description: "Full self-contained task for the subagent" },
      },
      required: ["subagent_type", "prompt"],
    },
  },
  {
    name: "edit_file",
    description:
      "Replace an exact block of text in a file. `search` must be copied verbatim (including indentation) from the current file contents and must be unique. Read the file first. Use this for precise edits instead of rewriting whole files.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Workspace-relative file path" },
        search: { type: "string", description: "Exact existing text to replace (unique in the file, unless replace_all is true)" },
        replace: { type: "string", description: "New text (empty string to delete the matched block)" },
        replace_all: { type: "boolean", description: "Replace every occurrence instead of requiring a unique match (e.g. renaming a variable)" },
      },
      required: ["path", "search", "replace"],
    },
  },
  {
    name: "write_file",
    description:
      "Create or overwrite a file with full content. Prefer edit_file for changes to existing files; use this for new files or full rewrites.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Workspace-relative file path" },
        content: { type: "string", description: "Full file content" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "create_file",
    description: "Create a new empty (or seeded) file. Fails silently if the file already exists.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Workspace-relative file path" },
        content: { type: "string", description: "Optional initial content" },
      },
      required: ["path"],
    },
  },
  {
    name: "delete_file",
    description: "Delete a file from the workspace. Destructive — only when clearly required by the task.",
    parameters: {
      type: "object",
      properties: { path: { type: "string", description: "Workspace-relative file path" } },
      required: ["path"],
    },
  },
  {
    name: "run_command",
    description:
      "Run a shell command in the workspace (e.g. `bun install`, `bun test`, `bun run build`, `ls`). Use to install deps, run tests, and VERIFY your changes. Output and exit code are returned.",
    parameters: {
      type: "object",
      properties: { command: { type: "string", description: "Shell command to run" } },
      required: ["command"],
    },
  },
];

export const AGENT_TOOL_NAMES = AGENT_TOOLS.map((t) => t.name);

/** Tools that mutate state or run code — gated behind approval in "ask" mode. */
export const WRITE_TOOLS = new Set(["edit_file", "write_file", "create_file", "delete_file", "run_command"]);

/** Read-only, side-effect-free tools — safe to execute in parallel. */
export const READ_TOOLS = new Set(["list_files", "read_file", "grep", "glob", "web_fetch"]);

/** Handled by the agent loop itself (no pod call): planning, delegation, asking. */
export const LOCAL_TOOLS = new Set(["todo_write", "spawn_subagent", "ask_user_question"]);

export type SubagentType = "explore" | "verify";

// Restricted toolsets per subagent type. Excludes spawn_subagent (no recursion),
// ask_user_question (subagents must not block on the user), and all file-mutation
// tools. `verify` may run commands to test.
const SUBAGENT_TOOL_NAMES: Record<SubagentType, string[]> = {
  explore: ["list_files", "read_file", "grep", "glob", "web_fetch"],
  verify: ["list_files", "read_file", "grep", "glob", "web_fetch", "run_command"],
};

export function subagentTools(type: SubagentType): AgentTool[] {
  const allow = new Set(SUBAGENT_TOOL_NAMES[type]);
  return AGENT_TOOLS.filter((t) => allow.has(t.name));
}

// ── Command safety (inspired by Claude Code's tiered bash permissions) ──────
// Three tiers: DENY (never run, even in auto), DANGEROUS (always confirm),
// READONLY (safe to auto-run even in ask mode). Compound commands are split so
// `echo ok && rm -rf /` is judged by its worst subcommand, and command
// substitution / backticks force confirmation (injection surface).

// Hard block — irreversible host/system damage. Never executed.
const DENY_COMMAND = /\b(mkfs\S*|dd\s+if=|shutdown|reboot|halt|poweroff|:\(\)\s*\{|chmod\s+-R\s+777\s+\/(?:\s|$)|rm\s+-[a-z]*\s+\/(?:\s|$))\b/i;

// Always confirm — destructive or outward-facing.
const DANGEROUS_COMMAND = /\b(rm\s+-[a-z]*r[a-z]*f|rm\s+-[a-z]*f[a-z]*r|git\s+push|git\s+reset\s+--hard|git\s+clean|sudo|npm\s+publish|docker\s+(rm|rmi|system\s+prune))\b/i;

// Piping a download straight into a shell — always confirm.
const PIPE_TO_SHELL = /\b(curl|wget|fetch)\b[^\n]*\|\s*(ba|z|k)?sh\b/i;

// Read-only / inspection commands — safe to auto-run even in ask mode.
const READONLY_COMMAND = /^(ls|cat|head|tail|grep|rg|find|pwd|echo|which|whoami|date|env|printenv|wc|stat|file|tree|du|df|bun\s+(pm\s+ls|--version)|node\s+--version|npm\s+(ls|view|--version)|git\s+(status|log|diff|show|branch|remote|rev-parse))\b/i;

const COMMAND_SUBSTITUTION = /\$\(|`|\$\{/;

export function isDangerousCommand(command: string): boolean {
  return DANGEROUS_COMMAND.test(command) || PIPE_TO_SHELL.test(command);
}

function splitSubcommands(command: string): string[] {
  // Split on &&, ||, ;, | — the operators that chain separate commands.
  return command
    .split(/\s*(?:&&|\|\||;|\|)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export type CommandVerdict = "deny" | "ask" | "auto";

/**
 * Classify a run_command request. Judged by the WORST subcommand in a chain.
 * `mode` is the agent's auto/ask mode; read-only commands auto-run in either.
 */
export function classifyCommand(command: string, mode: "auto" | "ask"): CommandVerdict {
  const subs = splitSubcommands(command);
  let verdict: CommandVerdict = mode === "auto" ? "auto" : "ask";

  for (const sub of subs) {
    if (DENY_COMMAND.test(sub)) return "deny";
    if (DANGEROUS_COMMAND.test(sub) || PIPE_TO_SHELL.test(sub)) verdict = "ask";
    else if (COMMAND_SUBSTITUTION.test(sub) && verdict !== "ask") verdict = "ask";
  }

  // In auto mode, downgrade to auto only if every subcommand is clearly read-only.
  if (mode === "auto" && verdict === "auto") return "auto";
  // In ask mode, allow obvious read-only single commands to run without a prompt.
  if (mode === "ask" && subs.length === 1 && subs[0] && READONLY_COMMAND.test(subs[0]) && !COMMAND_SUBSTITUTION.test(subs[0])) {
    return "auto";
  }
  return verdict;
}

/** Per-run state threaded through tool execution (read-before-edit tracking). */
export interface ToolContext {
  readPaths: Set<string>;
}

export function createToolContext(): ToolContext {
  return { readPaths: new Set() };
}

const READ_FILE_MAX_BYTES = 256 * 1024;
const GREP_MAX_LINES = 200;
const WEB_FETCH_MAX_BYTES = 120 * 1024;

export interface ToolExecResult {
  content: string;
  isError?: boolean;
}

function flattenTree(nodes: FileNode[], prefix = ""): string[] {
  const lines: string[] = [];
  for (const n of nodes) {
    if (n.type === "dir") {
      lines.push(`${prefix}${n.name}/`);
      lines.push(...flattenTree(n.children ?? [], `${prefix}  `));
    } else {
      lines.push(`${prefix}${n.name}`);
    }
  }
  return lines;
}

function str(input: Record<string, unknown>, key: string): string {
  const v = input[key];
  return typeof v === "string" ? v : "";
}

/**
 * Execute a tool against the pod and return a string result for the model.
 * `onExecOutput` streams command output to the caller (for the SSE timeline).
 */
export async function executeTool(
  pod: PodControl,
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
  onExecOutput?: (chunk: string) => void,
): Promise<ToolExecResult> {
  try {
    switch (name) {
      case "list_files": {
        const tree = await pod.listFiles();
        return { content: flattenTree(tree).join("\n") || "(empty workspace)" };
      }
      case "read_file": {
        const path = str(input, "path");
        const { content } = await pod.readFile(path);
        ctx.readPaths.add(path);
        if (content.length > READ_FILE_MAX_BYTES) {
          const shown = withLineNumbers(content.slice(0, READ_FILE_MAX_BYTES));
          return { content: `${shown}\n… [truncated: file is ${content.length} bytes; read a smaller range or grep for the part you need]` };
        }
        return { content: content ? withLineNumbers(content) : "(empty file)" };
      }
      case "grep": {
        const pattern = str(input, "pattern");
        const path = str(input, "path") || ".";
        const cmd =
          `grep -rIn --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next ` +
          `-e ${shellQuote(pattern)} ${shellQuote(path)} | head -n ${GREP_MAX_LINES + 1} || true`;
        const res = await pod.exec(cmd, onExecOutput, 30_000);
        const lines = res.output.trim().split("\n").filter(Boolean);
        if (lines.length === 0) return { content: "(no matches)" };
        if (lines.length > GREP_MAX_LINES) {
          return { content: `${lines.slice(0, GREP_MAX_LINES).join("\n")}\n[truncated at ${GREP_MAX_LINES} matches — narrow the pattern or path]` };
        }
        return { content: lines.join("\n") };
      }
      case "glob": {
        const pattern = str(input, "pattern");
        const base = str(input, "path") || ".";
        // Match the final path segment as a filename glob (handles `*.ts`, `**/*.tsx`, `name.json`).
        const namePart = pattern.split("/").pop() || pattern;
        const cmd =
          `find ${shellQuote(base)} \\( -type d \\( -name node_modules -o -name .git -o -name .next \\) -prune \\) -o ` +
          `-type f -name ${shellQuote(namePart)} -print 2>/dev/null | head -n ${GREP_MAX_LINES + 1} || true`;
        const res = await pod.exec(cmd, onExecOutput, 30_000);
        const files = res.output.trim().split("\n").map((l) => l.replace(/^\.\//, "")).filter(Boolean);
        if (files.length === 0) return { content: "(no files match)" };
        if (files.length > GREP_MAX_LINES) {
          return { content: `${files.slice(0, GREP_MAX_LINES).join("\n")}\n[truncated at ${GREP_MAX_LINES} files]` };
        }
        return { content: files.join("\n") };
      }
      case "web_fetch": {
        const url = str(input, "url");
        if (!/^https?:\/\//i.test(url)) {
          return { content: "web_fetch requires an absolute http(s) URL.", isError: true };
        }
        // Fetch via the pod (its egress), strip tags crudely, cap size.
        const cmd =
          `curl -sL --max-time 20 -A 'CloudBlocksAgent/1.0' ${shellQuote(url)} ` +
          `| sed -e 's/<[^>]*>/ /g' | tr -s ' \\n' | head -c ${WEB_FETCH_MAX_BYTES} || true`;
        const res = await pod.exec(cmd, onExecOutput, 30_000);
        const text = res.output.trim();
        return text
          ? { content: `Content of ${url}:\n${text}` }
          : { content: `Fetched ${url} but got no readable content (it may require JS or block bots).`, isError: true };
      }
      case "edit_file": {
        const path = str(input, "path");
        const search = str(input, "search");
        const replace = str(input, "replace");
        if (!search) return { content: "edit_file requires a non-empty `search`.", isError: true };
        if (!ctx.readPaths.has(path)) {
          return { content: `Read ${path} with read_file before editing it, so your search text matches exactly.`, isError: true };
        }
        const replaceAll = input.replace_all === true;
        const { content, version } = await pod.readFile(path);
        const matches = countOccurrences(content, search);
        if (matches === 0) {
          return { content: `search text not found in ${path}. Re-read the file and copy the exact text (including indentation).`, isError: true };
        }
        if (matches > 1 && !replaceAll) {
          return { content: `search text matches ${matches} places in ${path}. Add surrounding context (2–4 lines) to make it unique, or set replace_all=true to replace every occurrence.`, isError: true };
        }
        const next = replaceAll
          ? content.split(search).join(replace)
          : content.slice(0, content.indexOf(search)) + replace + content.slice(content.indexOf(search) + search.length);
        const { conflict } = await pod.writeFile(path, next, version);
        if (conflict) return { content: `${path} changed during edit; re-read and retry.`, isError: true };
        return { content: `Edited ${path}${replaceAll && matches > 1 ? ` (${matches} occurrences)` : ""}.` };
      }
      case "write_file": {
        const path = str(input, "path");
        const content = str(input, "content");
        const { conflict } = await pod.writeFile(path, content);
        if (conflict) return { content: `${path} changed concurrently; re-read and retry.`, isError: true };
        ctx.readPaths.add(path); // we now know its content — allow follow-up edits
        return { content: `Wrote ${path} (${content.length} bytes).` };
      }
      case "create_file": {
        const path = str(input, "path");
        await pod.createFile(path, str(input, "content"));
        ctx.readPaths.add(path);
        return { content: `Created ${path}.` };
      }
      case "delete_file": {
        const path = str(input, "path");
        await pod.deleteFile(path);
        return { content: `Deleted ${path}.` };
      }
      case "run_command": {
        const command = str(input, "command");
        const res = await pod.exec(command, onExecOutput);
        const status =
          res.signal === "TIMEOUT"
            ? "timed out"
            : res.code === 0
              ? "exit 0"
              : `exit ${res.code}${res.signal ? ` (signal ${res.signal})` : ""}`;
        const body = res.output.trim() || "(no output)";
        return { content: `$ ${command}\n${body}\n[${status}${res.truncated ? ", truncated" : ""}]`, isError: res.code !== 0 };
      }
      default:
        return { content: `Unknown tool: ${name}`, isError: true };
    }
  } catch (err) {
    return { content: `Tool ${name} failed: ${err instanceof Error ? err.message : String(err)}`, isError: true };
  }
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function withLineNumbers(content: string): string {
  const lines = content.split("\n");
  const width = String(lines.length).length;
  return lines.map((line, i) => `${String(i + 1).padStart(width, " ")}\t${line}`).join("\n");
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    count++;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return count;
}
