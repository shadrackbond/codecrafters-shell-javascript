const readline = require("readline/promises");
const fs = require("fs");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});


function exit(...args) {
  rl.close();
  process.exit(Number(args[0]) || 0);
}

function echo(args) {
  console.log(args.join(" "));
}

function type(...args) {
  if (args[0] === undefined) {
    console.log("type: missing argument");
  } else if (args[0] in commandToFunction) {
    console.log(`${args[0]} is a shell builtin`);
  } else {
    const path_dirs = process.env.PATH.split(":");
    for (const dir of path_dirs) {
      const filePath = `${dir}/${args[0]}`;
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        console.log(`${args[0]} is ${filePath}`);
        return;
      }
    }
    console.log(`${args[0]}: not found`);
  }
}

const commandToFunction = { 'exit': exit, 'echo': echo, "type": type };

async function REPL() {
  while (true) {
    const answer = await rl.question("$ ");
    const answerArray = answer.split(" ");
    if (answerArray[0] in commandToFunction) {
      commandToFunction[answerArray[0]](answerArray.slice(1));
    } else {
      console.log(`${answer}: command not found`);
    }
  }
}
REPL();
