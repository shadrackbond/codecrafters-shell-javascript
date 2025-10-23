const readline = require("readline");
const fs = require("fs")
const path = require("path")

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt() {

  rl.question("$ ", (answer) => {
    const input = answer.trim();
    let myAnswer = `${input}: command not found`;

    // 1. Handle exit command first
    if (input === 'exit' || input === 'exit 0' || input === '0') {
      rl.close();
      process.exit(0);
      return;// Stop execution after exiting
    }

    // Split the input into command and arguments
    const parts = input.split(/\s+/).filter(p => p.length > 0); // Filter out empty strings from split
    const command = parts[0];
    const args = parts.slice(1); // Keep args as an array of strings

    // 2. Handle 'echo' command
    if (command === 'echo') {
      // Join the rest of the parts to handle multiple spaces correctly
      myAnswer = parts.slice(1).join(' ');
    }

    // 3. Handle 'type' command
    else if (command === 'type') {
      const targetCommand = args[0]; // The command we're checking is the first argument

      if (!targetCommand) { // Check if an argument was provided
        // In a real shell, 'type' with no args often just prints nothing or an error, 
        // but based on your original intention, we'll keep a 'not found' message logic.
        myAnswer = "type: missing argument"; // Or an appropriate error message
      } else if (targetCommand === 'echo' || targetCommand === 'exit' || targetCommand === 'type') {
        myAnswer = `${targetCommand} is a shell builtin`;
      } else {
        // Assume 'not found' unless proven otherwise
        myAnswer = `${targetCommand}: not found`;
        let foundInPath = false;

        // Check in PATH environment variable
        // Make sure process.env.PATH exists before splitting
        if (process.env.PATH) {
          const path_dirs = process.env.PATH.split(":");

          for (const dir of path_dirs) {
            // Use path.join for correct path separators
            const filePath = path.join(dir, targetCommand);

            // Check if the file exists and is a regular file
            // fs.constants.F_OK ensures visibility, fs.constants.X_OK checks for execution permission (more complete check)
            try {
              if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                // Correctly set myAnswer for output
                myAnswer = `${targetCommand} is ${filePath}`;
                foundInPath = true;
                break; // Stop searching after finding the first one
              }
            } catch (e) {
              // Ignore errors like permission denied for statSync or existsSync failure
            }
          }
        }
      }
    }

    console.log(myAnswer);
    prompt();
  });
}

prompt();