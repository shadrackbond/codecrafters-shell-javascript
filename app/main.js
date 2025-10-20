const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

//Uncomment this block to pass the first stage

function prompt() {

  rl.question("$ ", (answer) => {
    if (answer === 'exit' || answer === 'exit 0' || answer === '0') {
      //console.log("exit 0")
      rl.close();
      process.exit(0);
    }
    let myAnswer = `${answer}: command not found`
// am thinking of making echo a variable
    const argument = 'echo';

    if(answer.includes(argument)){
      //const part = answer.substring(0,8);
      const newAnswer = answer.replace(argument,"") + '\n';
      myAnswer = newAnswer
    }
    //what if I do the output without the argument lie new answer - argument
    console.log(myAnswer)

    prompt();
  });
}

prompt();