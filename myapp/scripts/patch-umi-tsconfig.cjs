const fs = require('node:fs');
const path = require('node:path');

const tsconfigPath = path.join(__dirname, '..', 'src', '.umi', 'tsconfig.json');

if (!fs.existsSync(tsconfigPath)) {
  process.exit(0);
}

const raw = fs.readFileSync(tsconfigPath, 'utf8');
const json = JSON.parse(raw);

json.compilerOptions = {
  ...json.compilerOptions,
  ignoreDeprecations: '6.0',
};

fs.writeFileSync(tsconfigPath, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
