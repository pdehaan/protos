
var app = require('../fixtures/bootstrap'),
    vows = require('vows'),
    fs = require('fs'),
    assert = require('assert'),
    Multi = require('multi'),
    EventEmitter = require('events').EventEmitter;
    
vows.describe('View Rendering').addBatch({
  
  'View Messages (#msg template not present)': {
    
    topic: function() {
      
      var promise = new EventEmitter();

      var msgTemplate = app.fullPath('app/views/__restricted/msg.mustache');
      
      fs.renameSync(msgTemplate, msgTemplate + '1');
      
      app.request(app.url('/raw-message'), function(err, res, buf) {
        
        fs.renameSync(msgTemplate + 1, msgTemplate);
        
        promise.emit('success', [err, buf, res.headers]);
        
      });
      
      return promise;
      
    }, 
    
    'Sends responses in plain text with no template': function(data) {
      var err = data[0], buf = data[1], headers = data[2];
      assert.strictEqual(buf, "This is a raw message");
      assert.strictEqual(headers['content-type'], 'text/plain;charset=utf-8');
      assert.strictEqual(headers['status'], '200 OK');
    }
    
  }

}).addBatch({
  
  'Plain View Engine': {
    
    'Registers valid extensions': function() {
      assert.deepEqual(app.engines.plain.extensions, ['txt', 'txt.html']);
    },
    
    'Returns valid view buffer': function() {
      var buf = "<h1>HELLO WORLD</h1>";
      var tpl = app.engines.plain.render(buf);
      assert.strictEqual(buf, tpl(buf));
    }
    
  },
  
  'Markdown View Engine': {

    'Registers valid extensions': function() {
      assert.deepEqual(app.engines.markdown.extensions, ['md', 'md.html']);
    },
    
    'Returns valid view buffer': function() {
      var buf = "# Hello World \nSomething **very** important _indeed_";
      var tpl = app.engines.markdown.render(buf);
      var expected = '<h1>Hello World</h1>\n<p>Something <strong>very</strong> important <em>indeed</em></p>\n';
      assert.strictEqual(tpl(buf), expected);
    }
    
  }
  
}).addBatch({
  
  'Handlebars Integration': {
    
    topic: function() {
      
      var multi = new Multi(app);
      var promise = new EventEmitter();
      
      multi.curl('/handlebars-integration');
      
      multi.on('pre_exec', app.backupFilters);
      multi.on('post_exec', app.restoreFilters);
      
      multi.exec(function(err, results) {
        promise.emit('success', err || results[0])
      });
          
      return promise;
      
    },
    
    "Provides expected output": function(buf) {
      var output = fs.readFileSync('test/fixtures/handlebars-integration-output.txt', 'utf8');
      assert.equal(buf, output);
    }
    
  }
  
}).export(module);