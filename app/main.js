const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt() {

  rl.question("$ ", (answer) => {
    const input = answer.trim(); // Trim input once at the start
    let myAnswer = `${input}: command not found`;

    // 1. Handle exit command first
    if (input === 'exit' || input === 'exit 0' || input === '0') {
      rl.close();
      process.exit(0);
      return; // Stop execution after exiting
    }

    // Split the input into command and arguments
    const parts = input.split(/\s+/); // Splits by one or more spaces
    const command = parts[0];
    const args = parts.slice(1).join(' ');

    // 2. Handle 'echo' command
    if (command === 'echo') {
      // The logic here is simple: echo just prints the rest of the arguments
      myAnswer = args;
    }

    // 3. Handle 'type' command
    else if (command === 'type') {
      if (!args) {
        // If 'type' is called without an argument, it's non-standard, 
        // but we'll assume it needs an argument.
        myAnswer = "usage: type command";
      } else {
        const targetCommand = parts[1]; // The first argument after 'type'

        // Correct logic: check if the target command is a known shell builtin
        if (targetCommand === 'echo' || targetCommand === 'exit' || targetCommand === 'type') {
          myAnswer = `${targetCommand} is a shell builtin`;
        }
        // A placeholder for non-builtins (like finding an external executable)
        // For this shell, everything else is 'not found'
        else {
          myAnswer = `${targetCommand}: not found`;
        }
      }
    }

    console.log(myAnswer);
    prompt();
  });
}

prompt();