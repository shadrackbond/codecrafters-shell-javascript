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
      return;
    }

    // Split the input into command and arguments
    const parts = input.split(/\s+/).filter(p => p.length > 0);
    const command = parts[0];
    const args = parts.slice(1);

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
        // *** MODIFICATION STARTS HERE ***
        let foundPaths = [];

        // Check in PATH environment variable
        if (process.env.PATH) {
          const path_dirs = process.env.PATH.split(":");

          for (const dir of path_dirs) {
            const filePath = path.join(dir, targetCommand);

            try {
              // Check if the file exists and is a regular file
              if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                // Instead of breaking, add the path to the list
                foundPaths.push(filePath);
                // DO NOT break here
              }
            } catch (e) {
              // Ignore errors (e.g., permission denied, failed stat)
            }
          }
        }

        // After checking ALL directories, format the output
        if (foundPaths.length > 0) {
          // Join all found paths with newlines and format the message for each
          myAnswer = foundPaths.map(p => `${targetCommand} is ${p}`).join('\n');
        } else {
          // If nothing was found, output the 'not found' message
          myAnswer = `${targetCommand}: not found`;
        }
        // *** MODIFICATION ENDS HERE ***
      }
    }

    console.log(myAnswer);
    prompt();
  });
}

prompt();