
var app = require('../fixtures/bootstrap'),
    vows = require('vows'),
    assert = require('assert'),
    util = require('util');

vows.describe('lib/controller.js').addBatch({
  
  'Controller Integrity Checks': {
    
    'Routing functions are set': function() {
      var routeGet = app.controller.constructor.routingFunctions.get;
      assert.isFunction(routeGet);
    }
    
  },
  
  'Controller::getControllerByAlias': {
    
    'Returns the correct controler': function() {
      
      var controller = app.controller.getControllerByAlias('/blog');
    }
    
  }
    
}).export(module);