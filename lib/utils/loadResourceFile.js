const broccoli = require('broccoli');
const printFailure = require('./printFailure');

/**
 * TODO: doc
 */
module.exports = function loadResourceFile(resourcePath, options) {
  // note that we leave the heavy lifting to broccoli's loadBrocfile(), even for loading our own Destiny config file
  try {
    return broccoli.loadBrocfile(
      Object.assign({}, options, {
        brocfilePath: resourcePath,
      })
    );
  } catch (err) {
    printFailure(`Could not load resource '${resourcePath}'.`, err);
    throw err;
  }
};
