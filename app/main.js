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
 * * It automatically uses the current PATH value set by the shell, 
 * like the one set by the tester: PATH="/usr/bin:/usr/local/bin:$PATH".
 * * @param {string} command The command name to look for.
 * @returns {string | null} The full path to the executable if found, otherwise null.
 */
function findCommandInPath(command) {
  // 💡 This is the key: process.env.PATH reflects the path set by the shell.
  if (process.env.PATH) {
    // Split the PATH variable by the colon (:) separator
    const path_dirs = process.env.PATH.split(":");

    for (const dir of path_dirs) {
      // path.join handles constructing the full path correctly
      const filePath = path.join(dir, command);

      try {
        // Check if the file exists and is a regular file
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          return filePath; // Found it!
        }
      } catch (e) {
        // Ignore errors like permission denied or non-existent directories
      }
    }
  }
  return null; // Not found in any PATH directory
}

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

    // 4. Handle External Commands (Resolution only - requires child_process for execution)
    else {
      // Check if the command exists in the custom PATH
      const fullPath = findCommandInPath(command);

      if (fullPath) {
        // 💡 IMPORTANT: A full shell must execute the command here (using Node's `child_process`).
        // Since this code doesn't include execution, we default to 'command not found'
        // or whatever output is expected for an external command that is *found* but *not executed*.
        myAnswer = `${command}: command not found`; // Keeping original behavior for non-executed commands
      } else {
        myAnswer = `${command}: command not found`;
      }
    }


    console.log(myAnswer);
    prompt();
  });
}

prompt();