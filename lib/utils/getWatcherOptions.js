const childProcess = require('child_process');
const fs = require('fs');
const WatchDetector = require('watch-detector');
const getCWD = require('./getCWD');
const ui = require('./ui');

/**
 * TODO: doc
 */
module.exports = function getWatcherOptions(options) {
  const detector = new WatchDetector({
    ui,
    childProcess,
    fs,
    watchmanSupportsPlatform: /^win/.test(process.platform),
    root: getCWD(options),
  });
  const { watcher } = detector.findBestWatcherOption({
    watcher: options.watcher,
  });
  return {
    saneOptions: {
      poll: watcher === 'polling',
      watchman: watcher === 'watchman',
      node: watcher === 'node' || !watcher,
    },
  };
};
