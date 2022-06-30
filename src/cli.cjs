// if it doesn't work, use me :)

const child_process = require('child_process');
const process = require('process');
const path = require('path');

const nodeBinary = process.argv[0];
const targetScript = path.join(__dirname, 'cli.mjs');

const args = process.argv.slice(2);

child_process.spawn(nodeBinary, ['--experimental-modules', targetScript, ...args]);