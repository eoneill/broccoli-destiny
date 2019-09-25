const resolve = require('resolve');
const getCWD = require('./getCWD');
const printFailure = require('./printFailure');

const broccoliCache = {};

/**
 * TODO: doc
 */
function requireBroccoli(basedir) {
  try {
    const broccoliPath = resolve.sync('broccoli', {
      basedir,
    });
    return require(broccoliPath);
  } catch (e) {
    printFailure("Could not find 'Broccoli'. Please ensure that the project has an installed dependency on 'broccoli'.");
  }
}

/**
 * TODO: doc
 */
module.exports = function getBroccoli(options) {
  const cwd = getCWD(options);
  return (broccoliCache[cwd] = broccoliCache[cwd] || requireBroccoli(cwd));
};
