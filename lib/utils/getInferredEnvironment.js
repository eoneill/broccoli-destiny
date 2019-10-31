const validEnvironments = ['production', 'development'];

module.exports = function getInferredEnvironment(...names) {
  const valid = names.find(name => {
    return validEnvironments.includes(process.env[name]);
  });
  return valid && process.env[valid];
};
