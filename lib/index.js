const debugTree = require('broccoli-debug').buildDebugCallback('broccoli-destiny');
const chalk = require('chalk');
const childProcess = require('child_process');
const UI = require('console-ui');
const findup = require('findup-sync');
const fs = require('fs-extra');
const path = require('path');
const prettyMilliseconds = require('pretty-ms');
const resolve = require('resolve');
const walkSync = require('walk-sync');
const WatchDetector = require('watch-detector');
const copy = require('./utils/copy');

const ui = new UI();
const broccoliCache = {};
const defaultDestinyFile = 'broccoli-destiny-cli.{ts,js}';

function printError(...errors) {
  errors.forEach(error => {
    if (typeof error === 'string') {
      ui.writeLine(error, 'ERROR');
    } else {
      ui.writeError(error);
    }
  });
}

function printFailure(...errors) {
  printError(...errors);
  process.exit(1);
}

/**
 * TODO: doc
 */
function getCWD(options) {
  return (options && options.cwd) || process.cwd();
}

/**
 * TODO: doc
 */
function sequence(...callbacks) {
  return function doSequence(...args) {
    callbacks.filter(Boolean).forEach(callback => {
      callback(...args);
    });
  };
}

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
    printFailure(
      "Could not find 'Broccoli'. Please ensure that the project has an installed dependency on 'broccoli'."
    );
  }
}

/**
 * TODO: doc
 */
function getBroccoli(options) {
  const cwd = getCWD(options);
  return (broccoliCache[cwd] = broccoliCache[cwd] || requireBroccoli(cwd));
}

/**
 * TODO: doc
 */
function loadResourceFile(resourcePath, options) {
  const broccoli = getBroccoli(options);
  // note that we leave the heavy lifting to broccoli's loadBrocfile(), even for loading our own Destiny file
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
}

/**
 * TODO: doc
 */
function getWatcherOptions(options) {
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
}

/**
 * TODO: doc
 */
function getDestinyOutputHandler(outputPath) {
  return entry => {
    copy(entry, outputPath);
    // never unlink individual paths
    return false;
  };
}

/**
 * TODO: doc
 */
function normalizeDestinyObject(options) {
  let { output, priority, unlink, merge, before, after } = options;

  if (!output) {
    return;
  }

  if (typeof output === 'string') {
    const outputPath = output;
    before = sequence(before, merge ? () => fs.ensureDirSync(outputPath) : () => fs.emptyDirSync(outputPath));
    output = getDestinyOutputHandler(output);
  }

  if (typeof output !== 'function') {
    printFailure(`The 'output' must either be a String or a Function, but received ${typeof output}`);
  }

  // if `unlink` is not explicitly `false`, we register an `after` hook to remove the sub-tree
  if (unlink !== false) {
    after = sequence(after, ({ basePath }) => {
      fs.removeSync(basePath);
    });
  }

  return Object.assign(
    // default hooks
    {
      beforeEach() {},
      afterEach() {},
    },
    // merge with incoming properties
    options,
    // and overwrite with normalized properties
    {
      before: before || function before() {},
      after: after || function after() {},
      output,
      priority: priority || this.nextPriority++,
    }
  );
}

/**
 * TODO: doc
 */
function loadDestinyFile(options) {
  let { destinyPath } = options;
  if (!destinyPath) {
    destinyPath = findup(defaultDestinyFile, {
      nocase: true,
    });
  }

  if (!destinyPath) {
    printFailure('Could not find broccoli-destiny-cli.js');
  }

  return loadResourceFile(destinyPath, options)(options);
}

/**
 * TODO: doc
 *
 * @param {Builder} builder
 * @param {Function} handleSuccess
 * @param {Function} handleFailure
 */
function startBuilding(builder, handleSuccess, handleFailure) {
  ui.writeLine(chalk.green.bold.underline('Starting Build'));

  // if we are not using a watcher, simply use the builder
  if (!this.options.watch) {
    return builder
      .build()
      .then(handleSuccess)
      .catch(handleFailure);
  }

  // otherwise, use the watcher
  ui.writeLine(chalk.cyan('Watching for changes...'), 'INFO');
  const { Watcher } = this.broccoli;
  const watcher = new Watcher(builder, builder.watchedSourceNodeWrappers, getWatcherOptions(this.options));

  const quitWatcher = () => {
    watcher.quit();
  };

  watcher.on('buildSuccess', handleSuccess);
  watcher.on('buildFailure', handleFailure);

  if (this.options.verbose) {
    watcher.on('change', (event, filePath, basePath) => {
      const changePath = path.relative(this.options.cwd, path.join(basePath, filePath));
      ui.writeLine(chalk.yellow('Change detected:'), 'INFO');
      ui.writeLine(chalk.yellow(` > ${changePath}`), 'INFO');
    });
  }

  process.on('SIGINT', quitWatcher);
  process.on('SIGTERM', quitWatcher);

  return watcher.start();
}

class BroccoliDestiny {
  constructor(options, destinies) {
    this.nextPriority = 0;
    this.ui = ui;
    this.options = options || {};
    this.options.cwd = getCWD(options);
    this.destinies = [];
    this.broccoli = getBroccoli(this.options);

    // add our destinies
    this.add(destinies);
  }

  add(destiny) {
    // if no destiny, just exit
    if (!destiny) {
      return;
    }

    // if it's an array, add all of them
    if (Array.isArray(destiny)) {
      destiny.forEach(dest => {
        this.add(dest);
      });
    } else {
      this.destinies.push(normalizeDestinyObject.call(this, destiny));
    }
  }

  setup() {}

  cleanup() {}

  build() {
    // invoke the setup hooks
    this.setup();
    const brocfile = loadResourceFile(this.options.broccoliPath, this.options);
    const tree = debugTree(
      // invoke the brocfile, which will return the tree
      brocfile({
        env: this.options.environment,
      }),
      'fromBrocfile'
    );

    const tmpdir = path.resolve('tmp');
    fs.ensureDirSync(tmpdir);

    const { Builder } = this.broccoli;
    const builder = new Builder(tree, {
      // TODO: figure out how we can remove this
      // currently, webpack loaders blow up
      tmpdir,
    });

    const handleSuccess = () => {
      this.destinies
        .sort(({ priority: a }, { priority: b }) => {
          return a - b;
        })
        .forEach(destiny => {
          const { input, output, globs, ignore, before, beforeEach, after, afterEach } = destiny;
          const basePath = path.join(builder.outputPath, input);
          if (!fs.existsSync(basePath)) {
            // this tree does not exist, so just exit
            return;
          }

          const unlinks = [];

          // before hook
          before({
            basePath,
            outputPath: builder.outputPath,
            input,
          });
          walkSync.entries(basePath, { globs, ignore }).forEach(
            sequence(
              // beforeEach hook
              beforeEach,
              // process the entry
              entry => {
                const unlink = output(entry);
                if (unlink) {
                  unlinks.push(path.join(basePath, entry.relativePath));
                }
              },
              // afterEach hook
              afterEach
            )
          );
          // after hook
          after({
            basePath,
            outputPath: builder.outputPath,
            input,
          });

          // finally, remove anything that needs to be unlinked
          // we do this after the after() hook to ensure that the sub-tree is untouched until this point
          unlinks.forEach(unlinkPath => {
            fs.removeSync(unlinkPath);
          });
        });

      const totalTime = Math.round(builder.outputNodeWrapper.buildState.totalTime);
      const prettyTime = prettyMilliseconds(totalTime);
      ui.writeLine(chalk.green(`\u2714 Built in ${prettyTime} (or ${totalTime}ms) @ ${new Date().toString()}`));
    };

    const handleFailure = error => {
      printError(chalk.red('\u2717 Build Failure'), error);
    };

    return startBuilding
      .call(this, builder, handleSuccess, handleFailure)
      .catch(err => ui.writeError(err))
      .finally(() => {
        builder.cleanup();
        // invoke the cleanup hooks
        this.cleanup();
        process.exit(0);
      })
      .catch(err => {
        printFailure('Error during cleanup:', err);
      });
  }
}

module.exports.BroccoliDestiny = BroccoliDestiny;
module.exports.loadDestinyFile = loadDestinyFile;
