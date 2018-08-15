'use strict';

const fs = require('fs');

if (fs.existsSync(`${__dirname}/lib/addon.js`)) {
  // eslint-disable-next-line node/no-missing-require
  module.exports = require('./lib/addon');
} else {
  /* eslint-disable node/no-unpublished-require */
  require('ts-node').register({ project: `${__dirname}/ts/tsconfig.json` });
  module.exports = require('./ts/lib/addon');
}
