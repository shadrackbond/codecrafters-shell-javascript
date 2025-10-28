const readline = require("readline");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const os = require("os");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/**
 * Checks if a command exists and is a file in the directories
 * specified in the PATH environment variable.
 */
function findCommandInPath(command) {
  if (!process.env.PATH) return null;
  const pathDirs = process.env.PATH.split(path.delimiter).filter(p => p.length > 0);

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
      // Ignore errors
    }
  }
  return null;
}

/**
 * Parses a list of command parts for redirection tokens.
 * (Supports >, >>, 1>, 1>>, 2>, 2>>)
 */
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
        if (!parts[i + 1]) {
          console.error(`Redirection error: missing filename after ${part}`);
          return result;
        }
        result.stdoutFile = parts[i + 1];
        result.stdoutAppend = false;
        skipNext = true;
        break;
      case '>>':
      case '1>>':
        if (!parts[i + 1]) {
          console.error(`Redirection error: missing filename after ${part}`);
          return result;
        }
        result.stdoutFile = parts[i + 1];
        result.stdoutAppend = true;
        skipNext = true;
        break;
      case '2>':
        if (!parts[i + 1]) {
          console.error(`Redirection error: missing filename after ${part}`);
          return result;
        }
        result.stderrFile = parts[i + 1];
        result.stderrAppend = false;
        skipNext = true;
        break;
      case '2>>':
        if (!parts[i + 1]) {
          console.error(`Redirection error: missing filename after ${part}`);
          return result;
        }
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

    if (skipNext) {
      i += 2;
    } else {
      i++;
    }
  }
  return result;
}

/**
 * Writes output to the correct destination (file or console).
 */
function writeOutput(data, file, append, isError = false) {
  try {
    if (file) {
      const flags = append ? 'a' : 'w';
      fs.writeFileSync(file, data, { flags });
    } else {
      if (isError) {
        process.stderr.write(data);
      } else {
        process.stdout.write(data);
      }
    }
  } catch (e) {
    // Always report file write errors to the shell's stderr
    process.stderr.write(`Shell error writing to ${file}: ${e.message}\n`);
  }
}

async function prompt() {
  rl.question("$ ", (answer) => {

    const input = answer.trim();

    // Exit commands
    if (input === 'exit' || input === 'exit 0' || input === '0') {
      rl.close();
      process.exit(0);
      return;
    }

    // Parse redirection
    const parts = input.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    const parsed = parseRedirection(parts);
    const {
      command,
      args,
      stdoutFile,
      stdoutAppend,
      stderrFile,
      stderrAppend
    } = parsed;

    if (!command) {
      prompt();
      return;
    }

    // --- Built-in commands ---

    // echo
    if (command === 'echo') {
      const cleanedArgs = args.map(arg => {
        if ((arg.startsWith("'") && arg.endsWith("'")) ||
          (arg.startsWith('"') && arg.endsWith('"'))) {
          return arg.substring(1, arg.length - 1);
        }
        return arg;
      });

      const output = cleanedArgs.join(' ') + '\n';
      writeOutput(output, stdoutFile, stdoutAppend, false);
      prompt();
    }

    // type
    else if (command === 'type') {
      const targetCommand = args[0];
      let output;
      let isError = false;

      if (!targetCommand) {
        output = "type: missing argument\n";
        isError = true;
      }
      else if (['echo', 'exit', 'type', 'pwd', 'cd'].includes(targetCommand)) {
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
      prompt();
    }

    // pwd
    else if (command === "pwd") {
      const output = process.cwd() + '\n';
      writeOutput(output, stdoutFile, stdoutAppend, false);
      prompt();
    }

    // cd
    else if (command === "cd") {
      let targetDir;
      const originalArg = args[0] || '~';

      if (!args[0] || args[0] === '~') {
        targetDir = process.env.HOME || os.homedir();
      } else {
        targetDir = args[0];
      }

      if (targetDir.startsWith('~/')) {
        targetDir = path.join(os.homedir(), targetDir.slice(2));
      }

      try {
        if (!targetDir) {
          throw new Error('Home directory not found');
        }
        process.chdir(targetDir);
      }
      catch (err) {
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
      prompt();
    }

    // cat
    // cat (multi-file support)
    else if (command === 'cat') {
      if (args.length === 0) {
        prompt();
        return;
      }

      let index = 0;

      function readNext() {
        if (index >= args.length) {
          // all done
          prompt();
          return;
        }

        const filePath = args[index];
        index++;

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

          // Continue to next file after handling current one
          readNext();
        });
      }

      readNext();
    }

    // --- External commands ---
    else {
      const fullPath = findCommandInPath(command);

      if (fullPath) {
        let stdio = ['inherit', 'inherit', 'inherit'];
        let stdoutFd = null;
        let stderrFd = null;

        try {
          if (stdoutFile) {
            const flags = stdoutAppend ? 'a' : 'w';
            stdoutFd = fs.openSync(stdoutFile, flags);
            stdio[1] = stdoutFd;
          }

          if (stderrFile) {
            const flags = stderrAppend ? 'a' : 'w';
            stderrFd = fs.openSync(stderrFile, flags);
            stdio[2] = stderrFd;
          }

          const child = spawn(fullPath, args, {
            stdio,
            argv0: command
          });

          child.on('close', (code) => {
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
    }
  });
}

prompt();
