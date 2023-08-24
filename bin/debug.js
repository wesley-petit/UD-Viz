/** @file Running the build-debug script in the browser package. */
const exec = require('child-process-promise').exec;
const spawn = require('child_process').spawn;

/**
 * It prints the stdout and stderr of a result object
 *
 * @param {{stdout:string,stderr:string}} result - The result of the command execution.
 */
const printExec = function (result) {
  console.log('stdout: \n', result.stdout);
  console.log('stderr: \n', result.stderr);
};

exec('npm run build-debug --prefix ./packages/browser')
  .then(printExec)
  .then(() => {
    const child = spawn(
      'cross-env NODE_ENV=development node',
      ['./bin/backEnd.js'],
      {
        shell: true,
      }
    );

    child.stdout.on('data', (data) => {
      console.log(`${data}`);
    });
    child.stderr.on('data', (data) => {
      console.error('\x1b[31m', ` ERROR :\n${data}`);
    });
  });