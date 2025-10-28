const readline = require("readline");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const os = require("os");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// ---------- Utility Functions ----------

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

function ensureParentDir(filePath) {
  if (!filePath) return;
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ---------- Redirection Parser ----------

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
      case '>':
      case '1>':
        result.stdoutFile = parts[i + 1];
        result.stdoutAppend = false;
        skipNext = true;
        break;
      case '>>':
      case '1>>':
        result.stdoutFile = parts[i + 1];
        result.stdoutAppend = true;
        skipNext = true;
        break;
      case '2>':
        result.stderrFile = parts[i + 1];
        result.stderrAppend = false;
        skipNext = true;
        break;
      case '2>>':
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

    i += skipNext ? 2 : 1;
  }
  return result;
}

// ---------- Output Writer ----------

function writeOutput(data, file, append, isError = false) {
  try {
    if (file) {
      ensureParentDir(file);
      const flags = append ? 'a' : 'w';
      fs.writeFileSync(file, data, { flags });
    } else {
      if (isError) process.stderr.write(data);
      else process.stdout.write(data);
    }
  } catch (e) {
    console.error(`Shell error writing to ${file}: ${e.message}`);
  }
}

// ---------- Main Prompt ----------

async function prompt() {
  rl.question("$ ", (answer) => {
    const input = answer.trim();

    if (input === '' || input === '0') return prompt();

    // Exit command
    if (input === 'exit' || input === 'exit 0') {
      rl.close();
      process.exit(0);
      return;
    }

    const parts = input.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    const parsed = parseRedirection(parts);
    const { command, args, stdoutFile, stdoutAppend, stderrFile, stderrAppend } = parsed;

    if (!command) return prompt();

    // ---------- Built-ins ----------

    if (command === 'echo') {
      const cleanedArgs = args.map(arg => {
        if ((arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'"))) {
          return arg.slice(1, -1);
        }
        return arg;
      });
      const output = cleanedArgs.join(' ') + '\n';
      writeOutput(output, stdoutFile, stdoutAppend, false);
      return prompt();
    }

    if (command === 'type') {
      const targetCommand = args[0];
      let output, isError = false;

      if (!targetCommand) {
        output = "type: missing argument\n";
        isError = true;
      } else if (['echo', 'exit', 'type', 'pwd', 'cd'].includes(targetCommand)) {
        output = `${targetCommand} is a shell builtin\n`;
      } else {
        const fullPath = findCommandInPath(targetCommand);
        if (fullPath) {
          output = `${targetCommand} is ${fullPath}\n`;
        } else {
          output = `${targetCommand}: not found\n`;
          isError = true;
        }
      }

      writeOutput(output, isError ? stderrFile : stdoutFile, isError ? stderrAppend : stdoutAppend, isError);
      return prompt();
    }

    if (command === 'pwd') {
      const output = process.cwd() + '\n';
      writeOutput(output, stdoutFile, stdoutAppend, false);
      return prompt();
    }

    if (command === 'cd') {
      let targetDir;
      const originalArg = args[0] || '~';
      if (!args[0] || args[0] === '~') targetDir = process.env.HOME || os.homedir();
      else targetDir = args[0];

      try {
        process.chdir(targetDir);
      } catch (err) {
        let errorMsg;
        switch (err.code) {
          case 'ENOENT':
            errorMsg = `cd: ${originalArg}: No such file or directory\n`;
            break;
          case 'ENOTDIR':
            errorMsg = `cd: ${originalArg}: Not a directory\n`;
            break;
          default:
            errorMsg = `cd: ${err.message}\n`;
        }
        writeOutput(errorMsg, stderrFile, stderrAppend, true);
      }
      return prompt();
    }

    if (command === 'cat') {
      if (args.length === 0) return prompt();
      let index = 0;

      function readNext() {
        if (index >= args.length) return prompt();
        const filePath = args[index++];
        fs.readFile(filePath, 'utf8', (err, data) => {
          if (err) {
            let errorMsg;
            if (err.code === 'ENOENT') {
              errorMsg = `cat: ${filePath}: No such file or directory\n`;
            } else {
              errorMsg = `cat: Error reading file: ${err.message}\n`;
            }
            writeOutput(errorMsg, stderrFile, stderrAppend, true);
          } else {
            writeOutput(data, stdoutFile, stdoutAppend, false);
          }
          readNext();
        });
      }
      return readNext();
    }

    // ---------- External Commands ----------
    const fullPath = findCommandInPath(command);

    if (fullPath) {
      let stdio = ['inherit', 'inherit', 'inherit'];
      let stdoutFd = null;
      let stderrFd = null;

      try {
        if (stdoutFile) {
          ensureParentDir(stdoutFile);
          const flags = stdoutAppend ? 'a' : 'w';
          stdoutFd = fs.openSync(stdoutFile, flags);
          stdio[1] = stdoutFd;
        }
        if (stderrFile) {
          ensureParentDir(stderrFile);
          const flags = stderrAppend ? 'a' : 'w';
          stderrFd = fs.openSync(stderrFile, flags);
          stdio[2] = stderrFd;
        }

        const child = spawn(fullPath, args, { stdio, argv0: command });

        child.on('close', () => {
          if (stdoutFd !== null) fs.closeSync(stdoutFd);
          if (stderrFd !== null) fs.closeSync(stderrFd);
          prompt();
        });

        child.on('error', (err) => {
          if (stdoutFd !== null) fs.closeSync(stdoutFd);
          if (stderrFd !== null) fs.closeSync(stderrFd);
          writeOutput(`Error executing ${command}: ${err.message}\n`, stderrFile, stderrAppend, true);
          prompt();
        });
      } catch (e) {
        if (stdoutFd !== null) fs.closeSync(stdoutFd);
        if (stderrFd !== null) fs.closeSync(stderrFd);
        writeOutput(`Shell error: ${e.message}\n`, stderrFile, stderrAppend, true);
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
