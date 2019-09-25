const copy = require('./copy');

/**
 * TODO: doc
 */
module.exports = function getDestinyOutputHandler(outputPath) {
  return entry => {
    copy(entry, outputPath);
    // never unlink individual paths
    return false;
  };
};
