const readline = require("readline");
const fs = require("fs")
const path = require("path");
const { spawn } = require("child_process");
const { Console, error } = require("console");

const rl = readline.createInterface({//builds the interface
  input: process.stdin,
  output: process.stdout,
});
/**
 * Parses a list of command parts for redirection tokens.
 * @param {string[]} parts - The raw parts from the user's input.
 * @returns {object} An object containing:
 * - command: The command (first part)
 * - args: An array of "cleaned" arguments (with redirection parts removed)
 * - stdoutFile: File path for stdout (or null)
 * - stdoutAppend: Boolean (true if appending '>>')
 * - stderrFile: File path for stderr (or null)
 * - stderrAppend: Boolean (true if appending '2>>')
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

    // Check for redirection tokens
    switch (part) {
      case '>':
        result.stdoutFile = parts[i + 1];
        result.stdoutAppend = false;
        skipNext = true;
        break;
      case '>>':
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
        // This part is not a redirection token
        if (result.command === null) {
          result.command = part;
        } else {
          result.args.push(part);
        }
    }

    if (skipNext) {
      i += 2; // Skip this token and the filename
      if (i > parts.length) {
        // Handle syntax error: 'ls >' with nothing after
        // (For now, we'll just ignore it, but a real shell would error)
      }
    } else {
      i++;
    }
  }

  return result;
}

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
  rl.question("$ ", (answer) => {

    const input = answer.trim();

    // 1. Handle exit command (this is fine as-is)
    if (input === 'exit' || input === 'exit 0' || input === '0') {
      rl.close();
      process.exit(0);
      return;
    }

    // --- NEW PARSING LOGIC ---
    const parts = input.split(/\s+/).filter(p => p.length > 0);

    // Parse the parts for redirection and clean args
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
    // --- END NEW PARSING LOGIC ---


    // 2. Handle 'echo' command (Built-in)
    //    NOTE: This will NOT work with redirection yet! (See Step 4)
    if (command === 'echo') {
      console.log(args.join(' '));
      prompt();
    }

    // 3. Handle 'type' command (Built-in)
    //    (This doesn't need redirection)
    else if (command === 'type') {
      // ... your existing type logic (it's fine) ...
      // Remember to use 'args[0]' for the targetCommand
      const targetCommand = args[0];
      // ...
      prompt();
    }

    // 4. Handle 'pwd' command (Built-in)
    //    NOTE: This will NOT work with redirection yet! (See Step 4)
    else if (command === "pwd") {
      console.log(process.cwd());
      prompt();
    }

    // 5. Handle 'cd' command (Built-in)
    //    (This doesn't need redirection)
    else if (command === "cd") {
      // ... your existing cd logic (it's fine) ...
      // Remember to use 'args[0]' for the targetDir
      // ...
      prompt();
    }

    // 6. Handle 'cat' command (Built-in)
    //    NOTE: This will NOT work with redirection yet! (See Step 4)
    else if (command === 'cat') {
      // ... your existing cat logic ...
      // Remember to use 'args[0]' for filePath
      // ...
      // AND you must call prompt() inside the async callback
    }

    // 7. Handle External Commands (Non-built-ins)
    //    THIS IS WHERE WE IMPLEMENT REDIRECTION
    else {

      const fullPath = findCommandInPath(command);

      if (fullPath) {
        // --- NEW REDIRECTION LOGIC FOR SPAWN ---

        // Default stdio is to inherit from our shell
        let stdio = ['inherit', 'inherit', 'inherit']; // [stdin, stdout, stderr]
        let stdoutFd = null; // File descriptor for stdout
        let stderrFd = null; // File descriptor for stderr

        try {
          // --- Set up stdout ---
          if (stdoutFile) {
            const flags = stdoutAppend ? 'a' : 'w'; // 'a' for append, 'w' for write
            // Open the file and get a file descriptor (a number)
            stdoutFd = fs.openSync(stdoutFile, flags);
            stdio[1] = stdoutFd; // Tell spawn to write stdout to this file
          }

          // --- Set up stderr ---
          if (stderrFile) {
            const flags = stderrAppend ? 'a' : 'w';
            stderrFd = fs.openSync(stderrFile, flags);
            stdio[2] = stderrFd; // Tell spawn to write stderr to this file
          }

          // Spawn the process
          const child = spawn(fullPath, args, {
            stdio: stdio, // Use our new stdio array
            argv0: command
          });

          // Wait for the child process to finish
          child.on('close', (code) => {
            // --- CRITICAL: Close the file descriptors ---
            // If we don't do this, we'll have file leaks
            if (stdoutFd !== null) {
              fs.closeSync(stdoutFd);
            }
            if (stderrFd !== null) {
              fs.closeSync(stderrFd);
            }
            // Now, we can prompt again
            prompt();
          });

          child.on('error', (err) => {
            // ... (close FDs here too, just in case)
            if (stdoutFd !== null) fs.closeSync(stdoutFd);
            if (stderrFd !== null) fs.closeSync(stderrFd);
            console.error(`Error executing ${command}: ${err.message}`);
            prompt();
          });

        } catch (e) {
          // This catches errors from fs.openSync (e.g., permissions)
          console.error(`Redirection error: ${e.message}`);
          if (stdoutFd !== null) fs.closeSync(stdoutFd);
          if (stderrFd !== null) fs.closeSync(stderrFd);
          prompt();
        }

      } else {
        console.log(`${command}: command not found`);
        prompt();
      }
    }
  });
}

prompt()