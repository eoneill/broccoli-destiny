const ui = require('./ui');

module.exports = function printError(...errors) {
  errors.forEach(error => {
    if (typeof error === 'string') {
      ui.writeLine(error, 'ERROR');
    } else {
      ui.writeError(error);
    }
  });
};
