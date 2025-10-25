const readline = require("readline");
const fs = require("fs")
const path = require("path");
const { spawn } = require("child_process"); // Ensure 'spawn' is imported

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/**
 * Checks if a command exists and is a file in the directories
 * specified in the PATH environment variable.
 * @param {string} command The command name to look for.
 * @returns {string | null} The full path to the executable if found, otherwise null.
 */
function findCommandInPath(command) {
  // Use ':' as the separator for POSIX systems (Linux, macOS, etc.)
  if (!process.env.PATH) return null;

  const pathDirs = process.env.PATH.split(":").filter(p => p.length > 0);

  for (const dir of pathDirs) {
    const filePath = path.join(dir, command);

    try {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);

        if (stats.isFile()) {
          // Check for execution permission (X_OK)
          fs.accessSync(filePath, fs.constants.X_OK);
          return filePath;
        }
      }
    } catch {
      // Ignore errors (non-executable, not found, permission denied, etc.)
    }
  }

  return null;
}

// **NOTE: The incorrect spawn block has been removed.**

async function prompt() {
  rl.question("$ ", (answer) => {
    const input = answer.trim();

    // 1. Handle exit command
    if (input === 'exit' || input === 'exit 0' || input === '0') {
      rl.close();
      process.exit(0);
      return;
    }

    // Split the input into command and arguments
    const parts = input.split(/\s+/).filter(p => p.length > 0);
    const command = parts[0];
    const args = parts.slice(1);

    if (!command) { // Handle empty input
      prompt();
      return;
    }

    // 2. Handle 'echo' command (Built-in)
    if (command === 'echo') {
      console.log(parts.slice(1).join(' '));
      prompt();
    }

    // 3. Handle 'type' command (Built-in)
    else if (command === 'type') {
      const targetCommand = args[0];
      let output;

      if (!targetCommand) {
        output = "type: missing argument";
      } else if (targetCommand === 'echo' || targetCommand === 'exit' || targetCommand === 'type') {
        output = `${targetCommand} is a shell builtin`;
      } else {
        const fullPath = findCommandInPath(targetCommand);

        if (fullPath) {
          output = `${targetCommand} is ${fullPath}`;
        } else {
          output = `${targetCommand}: not found`;
        }
      }
      console.log(output);
      prompt();
    }

    // 4. Handle External Commands (Non-built-ins)
    else {
      const fullPath = findCommandInPath(command);

      if (fullPath) {
        // --- EXECUTE EXTERNAL COMMAND ASYNCHRONOUSLY ---
        try {
          // Use 'spawn' with the full executable path and arguments
          const child = spawn(fullPath, args, {
            // Connect the child's streams directly to the parent's terminal streams
            stdio: 'inherit'
          });

          // Wait for the child process to finish before prompting again
          child.on('close', (code) => {
            // If you want to show exit code: console.log(`[Process exited with code ${code}]`);
            prompt();
          });

          // Handle errors like spawning failure (e.g., permissions issue)
          child.on('error', (err) => {
            // E.g., spawn('a/path', ...) might fail if the file isn't executable despite checks
            console.error(`Error executing ${command}: ${err.message}`);
            prompt();
          });

        } catch (e) {
          // Catch synchronous errors during the spawn call itself
          console.error(`Failed to execute ${command}: ${e.message}`);
          prompt();
        }

      } else {
        // Command not found in built-ins or PATH
        console.log(`${command}: command not found`);
        prompt();
      }
    }
  });
}

prompt()