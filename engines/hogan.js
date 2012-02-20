
/* Hogan */

var hogan = corejs.require('hogan.js', true),
    util = require('util');
    
// https://github.com/twitter/hogan.js

var partials = {};

function Hogan(app) {
  this.app = app;
  this.module = hogan;
  this.multiPart = true;
  this.extensions = ['hogan', 'hogan.html', 'hg.html'];
  
  app.on('init', function() {
    // App partials
    Object.keys(app.views.partials).map(function(p) {
      var func = app.views.partials[p];
      if (func.tpl) partials[p] = func.tpl;
      else partials[p] = funcToPartial(func);
    });
  });
  
}

util.inherits(Hogan, corejs.lib.engine);

Hogan.prototype.render = function(data, vars) {
  data = this.app.applyFilters('hogan_template', data);
  var tpl, func = this.getCachedFunction(arguments);
  if (func === null) {
    tpl = hogan.compile(data);
    func = function(data, partials) {
      return tpl.render(data, partials); 
    }
    func.tpl = tpl;
    this.cacheFunction(func, arguments);
  }
  return this.evaluate(func, arguments, true);
}

Hogan.prototype.returnPartials = function() {
  return partials;
}

function funcToPartial(func) {
  // Compile a new partial. Using Math.random() to simulate 
  // Unique template content, which generates unique templates.
  var seed = Math.random();
  var tpl = hogan.compile(seed);
  
  // Delete the partial from seed (improves performance)
  delete hogan.cache[seed + '||false'];
  
  // Create a hogan compatible rendering function
  tpl.ri = function(locals) {
    return func(locals[0]);
  }
  
  return tpl;
}

module.exports = Hogan;
