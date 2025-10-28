const readline = require("readline");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const os = require("os"); // Needed for 'cd' home directory

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
      // Ignore errors
    }
  }
  return null;
}

/**
 * Parses a list of command parts for redirection tokens.
 * @returns {object} An object containing:
 * - command: The command (first part)
 * - args: An array of "cleaned" arguments (with redirection parts removed)
 * - stdoutFile: File path for stdout (or null)
 * - stdoutAppend: Boolean (true if appending '>>')
 * - stderrFile: File path for stderr (or null)
 * - stderrAppend: Boolean (true if appending '2>>')
 */
/**
 * Parses a list of command parts for redirection tokens.
 * (This version adds support for '1>' and '1>>')
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
      case '1>': // <-- ADDED THIS CASE
        result.stdoutFile = parts[i + 1];
        result.stdoutAppend = false;
        skipNext = true;
        break;
      case '>>':
      case '1>>': // <-- ADDED THIS CASE (for completeness)
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

    if (skipNext) {
      i += 2; // Skip this token and the filename
    } else {
      i++;
    }
  }
  return result;
}

/**
 * Writes output to the correct destination (file or console).
 * @param {string} data - The data to write.
 * @param {string | null} file - The file path (e.g., stdoutFile or stderrFile).
 * @param {boolean} append - Whether to append.
 * @param {boolean} isError - If true, write to process.stderr, otherwise process.stdout.
 */
function writeOutput(data, file, append, isError = false) {
  try {
    if (file) {
      const flags = append ? 'a' : 'w'; // 'a' for append, 'w' for write
      fs.writeFileSync(file, data, { flag: flags });
    } else {
      if (isError) {
        process.stderr.write(data);
      } else {
        process.stdout.write(data);
      }
    }
  } catch (e) {
    // This error goes to the shell's stderr, regardless
    console.error(`Shell error writing to ${file}: ${e.message}`);
  }
}


async function prompt() {
  rl.question("$ ", (answer) => {

    const input = answer.trim();

    // 1. Handle exit command
    if (input === 'exit' || input === 'exit 0' || input === '0') {
      rl.close();
      process.exit(0);
      return;
    }

    // --- PARSE FOR REDIRECTION ---
    const parts = input.split(/\s+/).filter(p => p.length > 0);
    const parsed = parseRedirection(parts);
    const {
      command,
      args,
      stdoutFile,
      stdoutAppend,
      stderrFile,
      stderrAppend
    } = parsed;

    if (!command) { // Handle empty input
      prompt();
      return;
    }

    // --- BUILT-IN COMMANDS ---

    // // 2. Handle 'echo' command
    // if (command === 'echo') {
    //   const output = args.join(' ') + '\n';

    //   if (stdoutFile) {
    //     const flags = stdoutAppend ? 'a' : 'w';
    //     try {
    //       fs.writeFileSync(stdoutFile, output, { flag: flags });
    //     } catch (e) {
    //       console.error(`Shell error: ${e.message}`);
    //     }
    //   } else {
    //     // Write to standard output (the screen)
    //     process.stdout.write(output);
    //   }

    //   // (You'd also add a check for stderrFile if echo could produce errors)
    //   prompt();
    // }

    // 2. Handle 'echo' command
    // 2. Handle 'echo' command
    else if (command === 'echo') {

      // Clean quotes from arguments
      const cleanedArgs = args.map(arg => {
        if ((arg.startsWith("'") && arg.endsWith("'")) || (arg.startsWith('"') && arg.endsWith('"'))) {
          // It's a quoted string, so return the inner part
          return arg.substring(1, arg.length - 1);
        }
        // It's not a quoted string, return it as-is
        return arg;
      });

      // Join the *cleaned* arguments
      const output = cleanedArgs.join(' ') + '\n';

      // Write to the correct destination (file or console)
      writeOutput(output, stdoutFile, stdoutAppend, false);

      // Go to the next prompt
      prompt();
    }

    // 3. Handle 'type' command
    else if (command === 'type') {
      const targetCommand = args[0];
      let output;
      let isError = false;

      if (!targetCommand) {
        output = "type: missing argument";
        isError = true;
      }
      else if (targetCommand === 'echo' || targetCommand === 'exit' || targetCommand === 'type' || targetCommand === 'pwd' || targetCommand === 'cat' || targetCommand === 'cd') {
        output = `${targetCommand} is a shell builtin`;
      } else {
        const fullPath = findCommandInPath(targetCommand);
        if (fullPath) {
          output = `${targetCommand} is ${fullPath}`;
        } else {
          output = `${targetCommand}: not found`;
          isError = true;
        }
      }

      output += '\n';

      if (isError) {
        writeOutput(output, stderrFile, stderrAppend, true); // Errors go to stderr
      } else {
        writeOutput(output, stdoutFile, stdoutAppend, false); // Success goes to stdout
      }

      prompt();
    }

    // 4. Handle 'pwd' command
    else if (command === "pwd") {
      const output = process.cwd() + '\n';
      // pwd output always goes to stdout
      writeOutput(output, stdoutFile, stdoutAppend, false);
      prompt();
    }

    // 5. Handle 'cd' command
    else if (command === "cd") {
      let targetDir;
      const originalArg = args[0] || '~';

      if (!args[0] || args[0] === '~') {
        targetDir = process.env.HOME || os.homedir();
      } else {
        targetDir = args[0];
      }

      try {
        if (!targetDir) {
          throw new Error('Home directory not found');
        }
        process.chdir(targetDir);
      }
      catch (err) {
        // 'cd' has no stdout, only stderr
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

    // 6. Handle 'cat' command
    else if (command === 'cat') {
      const filePath = args[0];
      if (!filePath) {
        // A real 'cat' would read from stdin, we'll just return
        prompt();
        return;
      }

      // fs.readFile is async, so prompt() must be called inside the callback
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          let errorMsg;
          if (err.code === 'ENOENT') {
            errorMsg = `cat: ${filePath}: No such file or directory\n`;
          } else {
            errorMsg = `cat: Error reading file: ${err.message}\n`;
          }
          // 'cat' errors go to stderr
          writeOutput(errorMsg, stderrFile, stderrAppend, true);
        } else {
          // 'cat' data goes to stdout
          writeOutput(data, stdoutFile, stdoutAppend, false);
        }
        // IMPORTANT: Call prompt *after* the async operation is done
        prompt();
      });
    }

    // --- EXTERNAL COMMANDS ---
    else {
      const fullPath = findCommandInPath(command);

      if (fullPath) {
        let stdio = ['inherit', 'inherit', 'inherit']; // [stdin, stdout, stderr]
        let stdoutFd = null;
        let stderrFd = null;

        try {
          // --- Set up stdout ---
          if (stdoutFile) {
            const flags = stdoutAppend ? 'a' : 'w';
            stdoutFd = fs.openSync(stdoutFile, flags);
            stdio[1] = stdoutFd;
          }

          // --- Set up stderr ---
          if (stderrFile) {
            const flags = stderrAppend ? 'a' : 'w';
            stderrFd = fs.openSync(stderrFile, flags);
            stdio[2] = stderrFd;
          }

          // Spawn the child process
          const child = spawn(fullPath, args, {
            stdio: stdio,
            argv0: command
          });

          // Wait for the child process to finish
          child.on('close', (code) => {
            // --- CRITICAL: Close the file descriptors ---
            if (stdoutFd !== null) fs.closeSync(stdoutFd);
            if (stderrFd !== null) fs.closeSync(stderrFd);
            prompt();
          });

          child.on('error', (err) => {
            if (stdoutFd !== null) fs.closeSync(stdoutFd);
            if (stderrFd !== null) fs.closeSync(stderrFd);
            // This is an error *executing* the command (e.g., permissions)
            // It goes to our shell's stderr
            writeOutput(`Error executing ${command}: ${err.message}\n`, stderrFile, stderrAppend, true);
            prompt();
          });

        } catch (e) {
          // This catches synchronous errors (e.g., fs.openSync)
          if (stdoutFd !== null) fs.closeSync(stdoutFd);
          if (stderrFd !== null) fs.closeSync(stderrFd);
          writeOutput(`Shell error: ${e.message}\n`, stderrFile, stderrAppend, true);
          prompt();
        }

      } else {
        // 7. Command not found
        const errorMsg = `${command}: command not found\n`;
        writeOutput(errorMsg, stderrFile, stderrAppend, true);
        prompt();
      }
    }
  });
}

prompt();