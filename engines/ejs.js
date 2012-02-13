
/* EJS */

var ejs = corejs.require('ejs', true),
    util = require('util');

// https://github.com/visionmedia/ejs

function EJS(app) {
  this.app = app;
  this.options = {open: '<%', close: '%>'}
  this.module = ejs;
  this.multiPart = true;
  this.extensions = ['ejs', 'ejs.html'];
}

util.inherits(EJS, corejs.lib.engine);

EJS.prototype.render = function(data) {
  data = this.app.applyFilters('ejs_template', data);
  var func = this.getCachedFunction(arguments);
  if (func === null) {
    func = ejs.compile(data, this.options);
    this.cacheFunction(func, arguments);
  }
  return this.evaluate(func, arguments);
}

module.exports = EJS;