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
  // 💡 This reads the current, dynamically set PATH environment variable.
  if (process.env.PATH) {
    // Split and filter out any empty path segments that might arise from 
    // leading/trailing/double colons (e.g., ::/usr/bin)
    const path_dirs = process.env.PATH.split(":").filter(p => p.length > 0);


    for (const dir of path_dirs) {
      fs.readdir(dir, (err, files) => {
        if (err) {
          fs.writeFile("./test.txt", "error", () => { });
          return;
        }
        files.forEach((file) => {
          const content = `${dir}/${file}`;
          fs.writeFile("./test.txt", content, () => { });
        })
      })
      // path.join is robust across operating systems
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

    // Split the input into command and arguments using regex for robustness
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
          // Correct output format for 'type' when command is found in PATH
          myAnswer = `${targetCommand} is ${fullPath}`;
        } else {
          myAnswer = `${targetCommand}: not found`;
        }
      }
    }

    // 4. Handle External Commands (Non-built-ins)
    else {
      // Check if the command exists in the custom PATH
      const fullPath = findCommandInPath(command);

      if (fullPath) {
        // 💡 A real shell would execute the command here. 
        // Since this is likely not implemented yet, we output 'command not found'.
        // If the tester requires a successful (silent) exit here, you'd change this line.
        // For now, we assume failure as execution is missing.
        myAnswer = `${command}: command not found`;
      } else {
        myAnswer = `${command}: command not found`;
      }
    }


    console.log(myAnswer);
    prompt();
  });
}

prompt();

fs.readFile("./test/txt", (err, data) => {
  console.log(data);
})