#!/usr/bin/env node
const readline = require("readline");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  completer: completer
});

const builtins = ["echo", "exit", "type", "pwd", "cd"];

function completer(line) {
  const completions = builtins.filter(cmd => cmd.startsWith(line));
  if (completions.length === 1) {
    return [[completions[0] + " "], line];
  }
  return [[], line];
}

function parseRedirection(tokens) {
  let stdoutPath = null, stderrPath = null;
  let appendStdout = false, appendStderr = false;
  const filtered = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === ">" || token === "1>") {
      stdoutPath = tokens[i + 1];
      appendStdout = false;
      i++;
    } else if (token === ">>" || token === "1>>") {
      stdoutPath = tokens[i + 1];
      appendStdout = true;
      i++;
    } else if (token === "2>") {
      stderrPath = tokens[i + 1];
      appendStderr = false;
      i++;
    } else if (token === "2>>") {
      stderrPath = tokens[i + 1];
      appendStderr = true;
      i++;
    } else {
      filtered.push(token);
    }
  }

  return { filtered, stdoutPath, stderrPath, appendStdout, appendStderr };
}

function redirectOutput(stdoutData, stderrData, stdoutPath, stderrPath, appendStdout, appendStderr) {
  try {
    if (stdoutPath) {
      fs.writeFileSync(stdoutPath, stdoutData, { flag: appendStdout ? "a" : "w" });
    } else if (stdoutData) {
      process.stdout.write(stdoutData);
    }

    if (stderrPath) {
      fs.writeFileSync(stderrPath, stderrData, { flag: appendStderr ? "a" : "w" });
    } else if (stderrData) {
      process.stderr.write(stderrData);
    }
  } catch (err) {
    console.error("Redirection error:", err);
  }
}

function runCommand(input) {
  input = input.trim();
  if (!input) return;

  const tokens = input.split(/\s+/);
  const { filtered, stdoutPath, stderrPath, appendStdout, appendStderr } = parseRedirection(tokens);
  const cmd = filtered[0];
  const args = filtered.slice(1);

  let stdoutData = "";
  let stderrData = "";

  if (cmd === "exit") {
    rl.close();
    process.exit(0);
  }

  else if (cmd === "echo") {
    stdoutData = args.join(" ") + "\n";
  }

  else if (cmd === "pwd") {
    stdoutData = process.cwd() + "\n";
  }

  else if (cmd === "cd") {
    const targetDir = args[0] || process.env.HOME;
    try {
      process.chdir(targetDir);
    } catch (err) {
      stderrData = `cd: ${targetDir}: No such file or directory\n`;
    }
  }

  else if (cmd === "type") {
    const target = args[0];
    if (builtins.includes(target)) {
      stdoutData = `${target} is a shell builtin\n`;
    } else {
      const resolved = process.env.PATH.split(":")
        .map(p => path.join(p, target))
        .find(p => fs.existsSync(p));
      stdoutData = resolved ? `${target} is ${resolved}\n` : `${target}: not found\n`;
    }
  }

  else if (cmd === "cat") {
    if (args.length === 0) return;

    for (const file of args) {
      try {
        const content = fs.readFileSync(file, "utf8");
        stdoutData += content.endsWith("\n") ? content : content + "\n";
      } catch (err) {
        stderrData += `cat: ${file}: No such file or directory\n`;
      }
    }
  }

  else {
    const external = spawnSync(cmd, args, { encoding: "utf8" });
    stdoutData = external.stdout || "";
    stderrData = external.stderr || "";
    if (external.error && external.error.code === "ENOENT") {
      stderrData = `${cmd}: command not found\n`;
    }
  }

  redirectOutput(stdoutData, stderrData, stdoutPath, stderrPath, appendStdout, appendStderr);
}

function prompt() {
  rl.question("$ ", line => {
    runCommand(line);
    prompt();
  });
}

prompt();
