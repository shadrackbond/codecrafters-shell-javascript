const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

//Uncomment this block to pass the first stage

function prompt() {

  rl.question("$ ", (answer) => {
    let myAnswer = `${answer}: command not found`
    console.log(myAnswer)

    //function to decide if shell should continue
    if (answer === 'exit') {
      rl.close;//close the interface
      return;//stop the function here
    }
    prompt();
  });
}

prompt();