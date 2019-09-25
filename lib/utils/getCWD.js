/**
 * TODO: doc
 */
module.exports = function getCWD(options) {
  return (options && options.cwd) || process.cwd();
};
