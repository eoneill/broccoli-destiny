const fs = require('fs-extra');
const path = require('path');

module.exports = function copy(entry, dest) {
  const { basePath, relativePath, mtime } = entry;
  const inputPath = path.join(basePath, relativePath);
  const outputPath = path.join(dest, relativePath);

  if (entry.isDirectory()) {
    // walk-sync doesn't provide us with the atime stat, so we must retrieve it manually
    const stats = fs.statSync(inputPath);
    const atime = stats.atime.getTime();
    fs.ensureDirSync(outputPath);
    fs.utimesSync(outputPath, atime, mtime);
  } else {
    // since we're using walk-sync and supporting globs/ignore, there's the possibility the parent directory doesn't exist
    // so we always make sure it exists
    fs.ensureDirSync(path.dirname(outputPath));
    fs.copyFileSync(inputPath, outputPath, {
      dereference: true,
      preserveTimestamps: true,
    });
  }
};
