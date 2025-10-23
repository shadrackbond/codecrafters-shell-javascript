const readline = require("readline");
const fs = require("fs")
const path = require("path")

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
  // process.env.PATH holds the exact value set by the tester (e.g., PATH="/usr/bin:/usr/local/bin:$PATH")
  if (process.env.PATH) {
    // Split the environment variable by the colon (:) separator
    const path_dirs = process.env.PATH.split(":");

    for (const dir of path_dirs) {
      // path.join handles constructing the full path correctly
      const filePath = path.join(dir, command);

      try {
        // Check if the file exists and is a regular file
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          return filePath; // Found it! Return the full path
        }
      } catch (e) {
        // Ignore errors like permission denied, empty path segments, or non-existent directories
      }
    }
  }
  return null; // Not found in PATH
}

// The rest of your prompt function is updated to use the helper function
function prompt() {

  rl.question("$ ", (answer) => {
    const input = answer.trim();
    let myAnswer = `${input}: command not found`;

    // 1. Handle exit command
    if (input === 'exit' || input === 'exit 0' || input === '0') {
      rl.close();
      process.exit(0);
      return;
    }

    const parts = input.split(/\s+/).filter(p => p.length > 0);
    const command = parts[0];
    const args = parts.slice(1);

    if (!command) { // Handle empty input
      prompt();
      return;
    }

    // 2. Handle 'echo' command
    if (command === 'echo') {
      myAnswer = parts.slice(1).join(' ');
    }

    // 3. Handle 'type' command
    else if (command === 'type') {
      const targetCommand = args[0];

      if (!targetCommand) {
        myAnswer = "type: missing argument";
      } else if (targetCommand === 'echo' || targetCommand === 'exit' || targetCommand === 'type') {
        myAnswer = `${targetCommand} is a shell builtin`;
      } else {
        // Use the reusable function to check the dynamic PATH
        const fullPath = findCommandInPath(targetCommand);

        if (fullPath) {
          myAnswer = `${targetCommand} is ${fullPath}`;
        } else {
          myAnswer = `${targetCommand}: not found`;
        }
      }
    }

    // 4. Handle External Commands (only checking for existence here)
    else {
      // If the command is not a built-in, you typically check PATH.
      const fullPath = findCommandInPath(command);

      if (fullPath) {
        // **ACTION REQUIRED:** A real shell would execute the command at 'fullPath' here.
        // Since your shell doesn't implement execution yet, it will fall through
        // and print 'command not found' unless you implement `child_process.spawn`.
        // For the scope of merely *checking* the random PATH, the logic is complete.
        myAnswer = `${command}: command not found`; // Retaining default unless execution is implemented
      } else {
        myAnswer = `${command}: command not found`;
      }
    }


    console.log(myAnswer);
    prompt();
  });
}

prompt();