const readline = require("readline");
const fs = require("fs")
const path = require("path");
const { spawn } = require("child_process");
const { Console } = require("console");

const rl = readline.createInterface({//builds the interface
  input: process.stdin,
  output: process.stdout,
});

/**
 * Checks if a command exists and is a file in the directories
 * specified in the PATH environment variable.
 * @param {string} command The command name to look for.
 * @returns {string | null} The full path to the executable if found, otherwise null.
 */
function findCommandInPath(command) {// defining that the function takes one argument
  //if PATH variable isnt set the functin returns null
  if (!process.env.PATH) return null;//Path is used to display path of the directory eg /usr/bin:/bin
  
  
  //split the path string into an array separated using colon : 
  //.filter removes the empty strings
  const pathDirs = process.env.PATH.split(":").filter(p => p.length > 0);

  // loop for iterating through every single directroty in the pathDirs array
  for (const dir of pathDirs) {

    const filePath = path.join(dir, command);// combines the dir and the command eg
    // dir = /usr/bin and command = ls the filePath will become /usr/bin/ls

    try {
      if (fs.existsSync(filePath)) {// checks if file or directory exists 
        // if the file or directory exists it retrieves its metadata using  fs.statSync
        const stats = fs.statSync(filePath);

        if (stats.isFile()) {//here we check fhe stats to ensure it points to a file and not a directory as directories are not executabe
          // accessSync checks if program has permission to access the file in a specific mode.
          //fs.constants.X_OK checks for execute permission
          fs.accessSync(filePath, fs.constants.X_OK); // if nos an executable it will throw an error
          //if all three checks pass(it exists, is a file and is executable) the function stops and returns
          //the full path /urs/bin/ls
          return filePath;
        }
      }
    } catch {
      // Ignore errors (non-executable, not found, permission denied, etc.)
    }
  }
  // if the entire loop completes without finidng a matching executable null is returned
  return null;
}

async function prompt() {
  rl.question("$ ", /*This is all a callback function*/(answer) => {//it passes the user input as answer
    
    const input = answer.trim();//removes whitespaces

    // 1. Handle exit command
    if (input === 'exit' || input === 'exit 0' || input === '0') {
      rl.close();//closes the readline interface stopping it from listening for any more input
      process.exit(0);//terminates the entire program
      return;//stops any more code inside the current callback from running
    }

    // Split the input into command and arguments
    //input.split splits the input string into an array of words using white spaces
    //.filter(p => p.length > 0) removes empty strings
    const parts = input.split(/\s+/).filter(p => p.length > 0);
    //here we are dividing the parts into command and arguments
    const command = parts[0];//since it is an array it takes the first part of the input at index 0 as a command 
    const args = parts.slice(1);// slice from index 1 and store them as arguments

    if (!command) { // Handle empty input
      prompt();// calls the prompt() again to show a new $prompt
      return;
    }
    // 2. Handle 'echo' command (Built-in)
    if (command === 'echo') {
      console.log(args.join(' '));
      prompt();// go back to prompting immediately
    }

    // 3. Handle 'type' command (Built-in)
    else if (command === 'type') {
      const targetCommand = args[0];
      let output;

      if (!targetCommand) {
        output = "type: missing argument";
      } 
      else if (targetCommand === 'echo' || targetCommand === 'exit' || targetCommand === 'type' || targetCommand ==='pwd') {
        output = `${targetCommand} is a shell builtin`;
      } else {
        //if the target command is not an inbuilt it uses the findCommandInPath function earlier made to search for its path
        //it then stores this path into a variable fullPath
        const fullPath = findCommandInPath(targetCommand);
        //if found in the files it will be displayed if not an error message will show
        if (fullPath) {
          output = `${targetCommand} is ${fullPath}`;
        } else {
          output = `${targetCommand}: not found`;
        }
      }
      console.log(output);
      prompt();
    }

    else if (command === "pwd"){
      console.log(process.cwd());
      prompt();
    }
    else if(command === "cd"){
      const changeDirectory = process.chdir(args[0])
     try{
       if (changeDirectory) {
         console.log(changeDirectory)
         prompt();
       }
       else {
         console.log(`cd: /${args[0]}: No such file or directory`)
         prompt();
       }
     } catch(error){
          console.log(error);
     }
      
      
    }

    // 5. Handle External Commands (Non-built-ins)
    else {

      const fullPath = findCommandInPath(command);

      if (fullPath) {
        // --- EXECUTE EXTERNAL COMMAND ASYNCHRONOUSLY ---
        try {
          // Spawn the process using the full path.
          // Pass args (argv[1] onwards) directly.
          const child = spawn(fullPath, args, {//spawn is where the external program is executed
            stdio: 'inherit',//It tells the child process to "inherit" the standard
            // input, output, and error streams from the parent (our shell)
            //Sets the program name (argv[0]) 
            // seen by the child process to the user-typed command 
            // (e.g., custom_exe_4701) instead of the full path 
            // (e.g., /tmp/bar/custom_exe_4701).
            argv0: command
          });

          // Wait for the child process to finish before prompting again
          //Asynchronous Wait: The shell must wait for the external command to finish. 
          //The 'close' event fires when the child process exits, 
          //and only then is prompt() called to display the $ prompt again.
          child.on('close', (code) => {
            // The prompt returns only after the external command exits.
            prompt();
          });

          // Handle errors like spawning failure (e.g., permissions issue)
          child.on('error', (err) => {
            console.error(`Error executing ${command}: ${err.message}`);
            prompt();
          });

        } catch (e) {
          // Catch synchronous errors during the spawn call itself
          console.error(`Failed to execute ${command}: ${e.message}`);
          prompt();
        }

      } 
      
      
      else {
        // Command not found in built-ins or PATH
        console.log(`${command}: command not found`);
        prompt();
      }
    }
  });
}

prompt()