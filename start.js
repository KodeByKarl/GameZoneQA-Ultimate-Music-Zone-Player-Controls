// index.js
require('bytenode');
try {
    require('./main.js');
} catch (err) {
    require('./main.jsc');
}
