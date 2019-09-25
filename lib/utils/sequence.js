/**
 * TODO: doc
 */
module.exports = function sequence(...callbacks) {
  return function doSequence(...args) {
    callbacks.filter(Boolean).forEach(callback => {
      callback(...args);
    });
  };
};
