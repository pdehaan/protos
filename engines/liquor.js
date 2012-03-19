
/* Liquor */

var liquor = require('liquor'),
    util = require('util');

// https://github.com/chjj/liquor

function Liquor(app) {
  this.app = app;
  
  var opts = (app.config.engines && app.config.engines.liquor) || {};

  this.options = protos.extend({
    pretty: true,
    indent: 0
  }, opts);

  this.module = liquor;
  this.multiPart = true;
  this.extensions = ['liquor', 'liquor.html', 'lq.html'];
}

util.inherits(Liquor, protos.lib.engine);

Liquor.prototype.render = function(data) {
  data = this.app.applyFilters('liquor_template', data);
  var func = this.getCachedFunction(arguments);
  if (func === null) {
    func = liquor.compile(data, this.options);
    this.cacheFunction(func, arguments);
  }
  return this.evaluate(func, arguments);
}
  
module.exports = Liquor;
