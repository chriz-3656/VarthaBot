const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../config');

function filePath(name) {
  return path.join(DATA_DIR, name);
}

function readJson(name, fallback) {
  try {
    const content = fs.readFileSync(filePath(name), 'utf8');
    return JSON.parse(content);
  } catch (error) {
    return fallback;
  }
}

function writeJson(name, value) {
  const full = filePath(name);
  const temp = `${full}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temp, full);
}

module.exports = {
  readJson,
  writeJson
};
