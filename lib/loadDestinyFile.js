const findup = require('findup-sync');
const BroccoliDestiny = require('./BroccoliDestiny');
const loadResourceFile = require('./utils/loadResourceFile');
const ui = require('./utils/ui');

const defaultDestinyFile = 'broccoli-destiny.config.{ts,js}';

/**
 * TODO: doc
 */
module.exports = function loadDestinyFile(options) {
  let { destinyPath } = options;
  if (!destinyPath) {
    destinyPath = findup(defaultDestinyFile, {
      nocase: true,
    });
  }

  let config;
  if (!destinyPath) {
    ui.writeLine(`Could not find broccoli-destiny.config.js`, 'WARN');
    config = {
      options: {},
    };
  } else {
    config = loadResourceFile(destinyPath, options)(options);
  }

  return new BroccoliDestiny(config);
};
