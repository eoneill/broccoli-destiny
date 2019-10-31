const { loadDestinyFile } = require('./index');
const getInferredEnvironment = require('./utils/getInferredEnvironment');

module.exports = function cli(args) {
  // always require a fresh commander, as it keeps state at module scope
  delete require.cache[require.resolve('commander')];
  const program = require('commander');
  let actionPromise;

  program.version(require('../package.json').version).usage('<command> [options] [<args ...>]');

  program
    .command('build [targets...]')
    .alias('b')
    .description('output files to the destinies declared in the destiny project')
    .option('--destiny-path <path>', 'the path to the destiny project file')
    .option('--brocfile-path <path>', 'the path to brocfile')
    .option('--cwd <path>', 'the path to working folder')
    .option('--watch', 'turn on the watcher')
    .option('--watcher <watcher>', 'select sane watcher mode')
    .option('-e, --environment <environment>', 'build environment', 'development')
    .option('--prod', 'alias for --environment=production')
    .option('--dev', 'alias for --environment=development')
    .option('--no-color', 'force no colors on the console')
    .action((targets, options) => {
      // the targets will be in the format of <input>:<output>
      // or simply <output>
      targets = targets.map(target => {
        // handle <input>:<output>
        if (target.includes(':')) {
          const [input, output] = target.split(':');
          return { input, output };
        }

        // handle <output>
        return {
          input: '.',
          output: target,
        };
      });

      if (options.prod) {
        options.environment = 'production';
      } else if (options.dev) {
        options.environment = 'development';
      } else if (!options.environment) {
        // otherwise, get the inferred environment from process.env, defaulting to `development`
        options.environment = getInferredEnvironment('BROCCOLI_ENV', 'NODE_ENV') || 'development';
      }

      const destiny = loadDestinyFile(options);
      destiny.add(targets);
      actionPromise = destiny.build();
    });

  program.parse(args || process.argv);

  if (!actionPromise) {
    program.outputHelp();
    return process.exit(1);
  }

  return actionPromise;
};
