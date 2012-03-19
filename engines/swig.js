
/* Swig */

var swig = require('swig'),
    util = require('util');

// https://github.com/paularmstrong/swig

function Swig(app) {
  this.app = app;
  
  var opts = (app.config.engines && app.config.engines.swig) || {};
  
  this.options = protos.extend({
    allowErrors: true,
    autoescape: true,
    encoding: 'utf-8',
    tags: {}
  }, opts);
  
  this.module = swig;
  this.multiPart = true;
  this.extensions = ['swig', 'swig.html', 'sw.html'];
}

util.inherits(Swig, protos.lib.engine);

Swig.prototype.render = function(data) {
  data = this.app.applyFilters('swig_template', data);
  var tpl, func = this.getCachedFunction(arguments);
  if (func === null) {
    tpl = swig.compile(data, this.options);
    // Wrap compiler in a new function, to make it
    // compatible with other view engines
    func = function(locals) {
      return tpl(locals);
    }
    this.cacheFunction(func, arguments);
  }
  return this.evaluate(func, arguments);
}

module.exports = Swig;
