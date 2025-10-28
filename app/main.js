const readline = require("readline");
const fs = require("fs");
const path = require("path");

// --- Built-in commands ---
const builtins = ["echo", "exit", "type", "pwd", "cd", "cat"];

// --- Advanced completer: builtins + PATH executables + files ---
function completer(line) {
  const words = line.trim().split(/\s+/);
  const lastWord = words.pop() || "";

  // First token → suggest builtins + PATH executables
  if (words.length === 0) {
    const pathDirs = process.env.PATH.split(":");
    const executables = pathDirs.flatMap((dir) => {
      try {
        return fs.readdirSync(dir);
      } catch {
        return [];
      }
    });

    const options = [...new Set([...builtins, ...executables])];
    let hits = options.filter((cmd) => cmd.startsWith(lastWord));

    if (hits.length === 1) {
      hits = [hits[0] + " "]; // ✅ add trailing space after unique match
    }

    return [hits.length ? hits : options, lastWord];
  }

  // After first token → suggest files in current directory
  try {
    const files = fs.readdirSync(process.cwd());
    let hits = files.filter((f) => f.startsWith(lastWord));

    if (hits.length === 1) {
      hits = [hits[0] + " "]; // ✅ add trailing space after unique match
    }

    return [hits.length ? hits : files, lastWord];
  } catch {
    return [[], lastWord];
  }
}

// --- Create readline interface with completer ---
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  completer,
  prompt: "$ ",
});

// --- Start the shell prompt ---
rl.prompt();

rl.on("line", (input) => {
  input = input.trim();
  if (input === "") {
    rl.prompt();
    return;
  }

  const [cmd, ...args] = input.split(/\s+/);

  switch (cmd) {
    case "exit":
      process.exit(0);
      break;

    case "echo":
      console.log(args.join(" "));
      break;

    default:
      console.log(`${cmd}: command not found`);
  }

  rl.prompt();
});
