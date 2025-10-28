const readline = require("readline");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const os = require("os"); // For cd ~ expansion

// ------------------ BUILT-INS ------------------
const builtins = ["echo", "exit", "type", "pwd", "cd"];

// ------------------ SIMPLE COMPLETER ------------------
function completer(line) {
  const hits = builtins.filter(cmd => cmd.startsWith(line));
  if (hits.length === 1) {
    // ✅ Add trailing space when only one match
    return [[hits[0] + " "], line];
  }
  return [hits.length ? hits : builtins, line];
}

// ------------------ READLINE SETUP ------------------
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  completer,
});

// ------------------ HELPERS ------------------
function ensureParentDir(file) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function findCommandInPath(command) {
  if (!process.env.PATH) return null;
  const pathDirs = process.env.PATH.split(":").filter(p => p.length > 0);

  for (const dir of pathDirs) {
    const filePath = path.join(dir, command);
    try {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
          fs.accessSync(filePath, fs.constants.X_OK);
          return filePath;
        }
      }
    } catch {
      // ignore
    }
  }
  return null;
}

function parseRedirection(parts) {
  const result = {
    command: null,
    args: [],
    stdoutFile: null,
    stdoutAppend: false,
    stderrFile: null,
    stderrAppend: false,
  };

  let i = 0;
  while (i < parts.length) {
    const part = parts[i];
    let skipNext = false;

    switch (part) {
      case ">":
      case "1>":
        result.stdoutFile = parts[i + 1];
        result.stdoutAppend = false;
        skipNext = true;
        break;
      case ">>":
      case "1>>":
        result.stdoutFile = parts[i + 1];
        result.stdoutAppend = true;
        skipNext = true;
        break;
      case "2>":
        result.stderrFile = parts[i + 1];
        result.stderrAppend = false;
        skipNext = true;
        break;
      case "2>>":
        result.stderrFile = parts[i + 1];
        result.stderrAppend = true;
        skipNext = true;
        break;
      default:
        if (result.command === null) {
          result.command = part;
        } else {
          result.args.push(part);
        }
    }

    if (skipNext) i += 2;
    else i++;
  }
  return result;
}

function writeOutput(data, file, append, isError = false) {
  try {
    if (file) {
      ensureParentDir(file);
      const flags = append ? "a" : "w";
      fs.writeFileSync(file, data, { flag: flags });
    } else {
      if (isError) process.stderr.write(data);
      else process.stdout.write(data);
    }
  } catch (e) {
    console.error(`Shell error writing to ${file}: ${e.message}`);
  }
}

// ------------------ MAIN PROMPT ------------------
async function prompt() {
  rl.question("$ ", (answer) => {
    const input = answer.trim();
    if (!input) return prompt();

    if (input === "exit" || input === "exit 0" || input === "0") {
      rl.close();
      process.exit(0);
      return;
    }

    const parts = input.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    const parsed = parseRedirection(parts);
    const {
      command,
      args,
      stdoutFile,
      stdoutAppend,
      stderrFile,
      stderrAppend,
    } = parsed;

    // ------------------ BUILT-IN: echo ------------------
    if (command === "echo") {
      const cleanedArgs = args.map((arg) => {
        if (
          (arg.startsWith('"') && arg.endsWith('"')) ||
          (arg.startsWith("'") && arg.endsWith("'"))
        ) {
          return arg.slice(1, -1);
        }
        return arg;
      });
      const output = cleanedArgs.join(" ") + "\n";
      writeOutput(output, stdoutFile, stdoutAppend, false);

      // Touch stderr file if redirected
      if (stderrFile) {
        ensureParentDir(stderrFile);
        try {
          fs.closeSync(fs.openSync(stderrFile, "a"));
        } catch (e) {
          console.error(`Shell error touching ${stderrFile}: ${e.message}`);
        }
      }

      return prompt();
    }

    // ------------------ BUILT-IN: type ------------------
    if (command === "type") {
      const target = args[0];
      let output = "";
      let isError = false;

      if (!target) {
        // No arg given, just return to prompt
        return prompt();
      }

      // 1. Check if it's a builtin first
      if (builtins.includes(target)) {
        output = `${target} is a shell builtin\n`;
      }
      // 2. Otherwise, look through PATH
      else {
        const fullPath = findCommandInPath(target);
        if (fullPath) {
          output = `${target} is ${fullPath}\n`;
        } else {
          // --- THIS IS THE FIX ---
          // Removed "type: " from the start of the string
          output = `${target}: not found\n`;
          // --- END OF FIX ---
          isError = true;
        }
      }

      // 3. Use writeOutput to respect redirection
      if (isError) {
        writeOutput(output, stderrFile, stderrAppend, true);
      } else {
        writeOutput(output, stdoutFile, stdoutAppend, false);
      }

      return prompt();
    }
    // ------------------ BUILT-IN: pwd ------------------
    if (command === "pwd") {
      const output = process.cwd() + "\n";
      writeOutput(output, stdoutFile, stdoutAppend, false);
      return prompt();
    }

    // ------------------ BUILT-IN: cd ------------------
    if (command === "cd") {
      let targetDir;
      const originalArg = args[0] || "~";
      if (!args[0] || args[0] === "~") {
        targetDir = process.env.HOME || os.homedir();
      } else {
        targetDir = args[0];
      }

      try {
        process.chdir(targetDir);
      } catch (err) {
        let errorMsg;
        switch (err.code) {
          case "ENOENT":
            errorMsg = `cd: ${originalArg}: No such file or directory\n`;
            break;
          case "ENOTDIR":
            errorMsg = `cd: ${originalArg}: Not a directory\n`;
            break;
          default:
            errorMsg = `cd: ${err.message}\n`;
        }
        writeOutput(errorMsg, stderrFile, stderrAppend, true);
      }
      return prompt();
    }

    // ------------------ BUILT-IN: cat ------------------
    if (command === 'cat') {
      if (args.length === 0) return prompt();

      let combinedOutput = '';
      let combinedError = '';

      for (const filePath of args) {
        try {
          const data = fs.readFileSync(filePath, 'utf8');
          combinedOutput += data; // ✅ Just append the data exactly as-is
        } catch (err) {
          if (err.code === 'ENOENT') {
            combinedError += `cat: ${filePath}: No such file or directory\n`;
          } else {
            combinedError += `cat: Error reading file: ${err.message}\n`;
          }
        }
      }

      if (combinedOutput) writeOutput(combinedOutput, stdoutFile, stdoutAppend, false);
      if (combinedError) writeOutput(combinedError, stderrFile, stderrAppend, true);
      return prompt();
    }


    // ------------------ EXTERNAL COMMANDS ------------------
    const fullPath = findCommandInPath(command);
    if (fullPath) {
      let stdio = ["inherit", "inherit", "inherit"];
      let stdoutFd = null;
      let stderrFd = null;

      try {
        if (stdoutFile) {
          ensureParentDir(stdoutFile);
          const flags = stdoutAppend ? "a" : "w";
          stdoutFd = fs.openSync(stdoutFile, flags);
          stdio[1] = stdoutFd;
        }

        if (stderrFile) {
          ensureParentDir(stderrFile);
          const flags = stderrAppend ? "a" : "w";
          stderrFd = fs.openSync(stderrFile, flags);
          stdio[2] = stderrFd;
        }

        const child = spawn(fullPath, args, { stdio, argv0: command });

        child.on("close", () => {
          if (stdoutFd !== null) fs.closeSync(stdoutFd);
          if (stderrFd !== null) fs.closeSync(stderrFd);
          prompt();
        });

        child.on("error", (err) => {
          if (stdoutFd !== null) fs.closeSync(stdoutFd);
          if (stderrFd !== null) fs.closeSync(stderrFd);
          writeOutput(
            `Error executing ${command}: ${err.message}\n`,
            stderrFile,
            stderrAppend,
            true
          );
          prompt();
        });
      } catch (e) {
        if (stdoutFd !== null) fs.closeSync(stdoutFd);
        if (stderrFd !== null) fs.closeSync(stderrFd);
        writeOutput(
          `Shell error: ${e.message}\n`,
          stderrFile,
          stderrAppend,
          true
        );
        prompt();
      }
    } else {
      const errorMsg = `${command}: command not found\n`;
      writeOutput(errorMsg, stderrFile, stderrAppend, true);
      prompt();
    }
  });
}

prompt();
