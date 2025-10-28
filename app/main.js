const readline = require("readline");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const builtins = ["echo", "exit", "cd", "pwd", "type"];

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  completer: (line) => {
    const matches = builtins.filter((b) => b.startsWith(line));
    return [matches.length ? matches : builtins, line];
  },
});

function prompt() {
  rl.setPrompt("$ ");
  rl.prompt();
}

// Check if command is executable in PATH
function findExecutable(cmd) {
  const pathDirs = process.env.PATH.split(":");
  for (const dir of pathDirs) {
    const fullPath = path.join(dir, cmd);
    try {
      fs.accessSync(fullPath, fs.constants.X_OK);
      return fullPath;
    } catch {
      continue;
    }
  }
  return null;
}

// Handle commands
function handleCommand(input) {
  input = input.trim();
  if (!input) return prompt();

  // Handle redirection operators
  let stdoutRedirect = null;
  let stderrRedirect = null;
  let appendStdout = false;
  let appendStderr = false;

  const stdoutMatch = input.match(/(1?>|>>)\s*(\S+)/);
  const stderrMatch = input.match(/2(>>|>)\s*(\S+)/);

  if (stderrMatch) {
    appendStderr = stderrMatch[1] === ">>";
    stderrRedirect = stderrMatch[2];
    input = input.replace(stderrMatch[0], "").trim();
  }
  if (stdoutMatch) {
    appendStdout = stdoutMatch[1].includes(">>");
    stdoutRedirect = stdoutMatch[2];
    input = input.replace(stdoutMatch[0], "").trim();
  }

  const parts = input.split(" ").filter(Boolean);
  const cmd = parts[0];
  const args = parts.slice(1);

  if (cmd === "exit") {
    rl.close();
    return;
  }

  if (cmd === "cd") {
    const dir = args[0] || process.env.HOME;
    try {
      process.chdir(dir);
    } catch {
      console.error(`cd: ${dir}: No such file or directory`);
    }
    return prompt();
  }

  if (cmd === "pwd") {
    console.log(process.cwd());
    return prompt();
  }

  if (cmd === "echo") {
    console.log(args.join(" "));
    return prompt();
  }

  if (cmd === "type") {
    const target = args[0];
    if (!target) {
      console.error("type: missing argument");
      return prompt();
    }
    if (builtins.includes(target)) {
      console.log(`${target} is a shell builtin`);
    } else {
      const found = findExecutable(target);
      if (found) {
        console.log(`${target} is ${found}`);
      } else {
        console.log(`type: ${target}: not found`);
      }
    }
    return prompt();
  }

  // Otherwise, run as external command
  const foundPath = findExecutable(cmd);
  if (!foundPath) {
    console.error(`Command not found: ${cmd}`);
    return prompt();
  }

  const options = {};
  let stdoutStream = process.stdout;
  let stderrStream = process.stderr;

  if (stdoutRedirect) {
    stdoutStream = fs.createWriteStream(stdoutRedirect, {
      flags: appendStdout ? "a" : "w",
    });
  }
  if (stderrRedirect) {
    stderrStream = fs.createWriteStream(stderrRedirect, {
      flags: appendStderr ? "a" : "w",
    });
  }

  const result = spawnSync(foundPath, args, {
    stdio: ["inherit", "pipe", "pipe"],
  });

  if (result.stdout.length) stdoutStream.write(result.stdout);
  if (result.stderr.length) stderrStream.write(result.stderr);

  if (stdoutRedirect) stdoutStream.end();
  if (stderrRedirect) stderrStream.end();

  prompt();
}

rl.on("line", handleCommand);
prompt();
