const { Builder, Watcher } = require('broccoli');
const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const prettyMilliseconds = require('pretty-ms');
const walkSync = require('walk-sync');
const debugTree = require('./utils/debugTree');
const getCWD = require('./utils/getCWD');
const getDestinyOutputHandler = require('./utils/getDestinyOutputHandler');
const getWatcherOptions = require('./utils/getWatcherOptions');
const loadResourceFile = require('./utils/loadResourceFile');
const printError = require('./utils/printError');
const printFailure = require('./utils/printFailure');
const sequence = require('./utils/sequence');
const ui = require('./utils/ui');

function normalizeTargetObject(options) {
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

module.exports = class BroccoliDestiny {
  constructor({ options, targets, plugins }) {
    this.nextPriority = 0;
    this.ui = ui;
    this.options = options || {};
    this.options.cwd = getCWD(options);
    this.targets = [];
    this.plugins = plugins || [];

    this.plugins.forEach(plugin => {
      // if the plugin init() returns, update the targets
      const result = plugin.init(this, { targets });
      if (result && result.targets) {
        targets = result.targets;
      }
    });

    this.add(targets);
  }

  add(target) {
    // if no target, just exit
    if (!target) {
      return;
    }

    // if it's an array, add all of them
    if (Array.isArray(target)) {
      target.forEach(target => {
        this.add(target);
      });
    } else {
      this.targets.push(normalizeTargetObject.call(this, target));
    }
  }

  setup() {
    this.plugins.forEach(plugin => plugin.setup());
  }

  cleanup() {
    this.plugins.forEach(plugin => plugin.cleanup());
  }

  build() {
    // invoke the setup hooks
    this.setup();
    const brocfile = loadResourceFile(this.options.brocfilePath, this.options);
    const tree = debugTree(
      // invoke the brocfile, which will return the tree
      brocfile({
        env: this.options.environment,
      }),
      'fromBrocfile'
    );

    const tmpdir = path.resolve('tmp');
    fs.ensureDirSync(tmpdir);

    const builder = new Builder(tree, {
      // TODO: figure out how we can remove this
      // currently, webpack loaders blow up
      tmpdir,
    });

    const handleSuccess = () => {
      this.targets
        .sort(({ priority: a }, { priority: b }) => {
          return a - b;
        })
        .forEach(target => {
          const { input, output, globs, ignore, before, beforeEach, after, afterEach } = target;
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
};
