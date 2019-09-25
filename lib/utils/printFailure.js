const printError = require('./printError');

module.exports = function printFailure(...errors) {
  printError(...errors);
  process.exit(1);
};
