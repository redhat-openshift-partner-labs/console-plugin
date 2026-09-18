const { readFileSync } = require('fs');
const { parse } = require('yaml');

module.exports = {
  process(_sourceText, sourcePath) {
    const content = readFileSync(sourcePath, 'utf8');
    const data = parse(content);
    return { code: `module.exports = ${JSON.stringify(data)};` };
  },
};
