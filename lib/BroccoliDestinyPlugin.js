const printFailure = require('./utils/printFailure');

module.exports = class BroccoliDestinyPlugin {
  constructor(name) {
    if (!name) {
      printFailure(new Error(`This broccoli-destiny plugin did not specify a name: ${this.constructor && this.constructor.name}`));
    }
    this.pluginName = name;
  }

  init() {}
  setup() {}
  cleanup() {}
};
