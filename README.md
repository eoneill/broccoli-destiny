# broccoli-destiny

`broccoli-destiny` is a wrapper around `broccoli` that supports outputting Broccoli sub-trees to multiple target destinations.

`broccoli-destiny` provides a CLI and a programmatic interface.

## CLI Usage

`broccoli-destiny` supports most of `broccoli` CLI's command line options. However, `broccoli-destiny` currently only supports the `build` command and does not support `serve`.

### Single Output Destination

```sh
broccoli-destiny build ./dist
```

will output the entire Broccoli tree to the `./dist` directory. This is essentially equivalent to `broccoli build ./dist`.

### Multiple Output Destinations

Given the following Broccoli tree:

```
├── a
│   └── a.js
├── b
│   └── b.js
├── c
│   └── c.js
└── root.js
```

```sh
broccoli-destiny build a:./distA b:./distB dist
```

will output the sub-tree of `./a` into `./distA`, `./b` into `./distB`, and everything else into `./dist`:

```
├── distA
│   └── a.js
├── distB
│   └── b.js
├── c
│   └── c.js
└── root.js
```

## Configuration

By default, `broccoli-destiny` will attempt to load a `broccoli-destiny.config.js` file, if it exists. You can specify your own file path using the `--destiny-path` option:

```
broccoli-destiny build --destiny-path=myCustomDestinyConfig.js
```

### Configuration File

```js
// export a function that accepts incoming Broccoli options
module.exports = (options) => {
  // return the config
  return {
    // outgoing Broccoli options (passed to Brocfile)
    options,
    // custom broccoli-destiny targets go here
    targets: [

    ],
    // plugins (see below)
    plugins: [],
  };
};
```

### Example

Given the following Broccoli tree:

```
├── a
│   └── a.js
├── b
│   └── b.js
├── c
│   └── c.js
└── root.js
```

and the following `broccoli-destiny.config.js`:

```js
const path = require('path');
module.exports = (options) => {
  return {
    options,
    targets: [
      {
        input: 'a',
        output: path.resolve('distA'),
      },
      {
        input: 'b',
        output: path.resolve('distB'),
      },
      {
        input: '.',
        output: path.resolve('dist'),
      },
    ],
  };
};
```

and the following command:

```sh
broccoli-destiny build
```

will output the sub-tree of `./a` into `./distA`, `./b` into `./distB`, and everything else into `./dist`:

```
├── distA
│   └── a.js
├── distB
│   └── b.js
├── c
│   └── c.js
└── root.js
```

## Plugins

### Example

```js
// MyDestinyPlugin.js
const path = require('path');
const { BroccoliDestinyPlugin } = require('broccoli-destiny');
const subTreeDir = './my-custom-tree';

module.exports = class MyDestinyPlugin extends BroccoliDestinyPlugin {
  constructor(options) {
    super();
    this.customOptions = options;
  }

  init(destiny, { targets }) {
    // initialize _before_ we load the Brocfile
    const { customOptions } = this;

    // return the new destiny targets
    return {
      // prepend our targets
      targets: [
        // <subTreeDir>/merged gets merged to <appRoot>/merged
        {
          input: path.join(subTreeDir, 'merged'),
          output: path.join(customOptions.appRoot, 'merged'),
          // we want to preserve the existing _codegen directory, so merge our output
          merge: true,
        },

        // everything else in <subTreeDir>/ gets merged to the buildDest
        {
          input: destDir,
          output: customOptions.buildDest,
        },

        // add the rest of the targets _after_ our custom targets
        ...targets,
      ],
    };
  }

  // perform any custom setup actions to be invoked _before_ each build is started (but after Brocfile is loaded)
  setup() {
    super.setup();
    // ...
  }

  // perform any custom cleanup actions to be invoked _after_ each build has finished
  cleanup() {
    super.cleanup();
    // ...
  }
};
```

```js
// broccoli-destiny.config.js
const MyDestinyPlugin = require('./MyDestinyPlugin');

module.exports = (options) => {
  return {
    options,
    plugins: [
      new MyDestinyPlugin({
        appRoot: __dirname,
        // where `options.environment` is the Broccoli environment
        buildDest: options.environment === 'production' ? path.resolve('./dist') : path.resolve('./tmp/dist')
      })
    ]
  }
};
```
