// preload-loader.js
const path = require('path');
require('bytenode');
try {
    require(path.join(__dirname, 'preload.js'));
} catch (err) {
    require(path.join(__dirname, 'preload.jsc'));
}
