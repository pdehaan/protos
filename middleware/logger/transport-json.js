
/* Logger » JSON Transport */

var app = protos.app;

function JSONTransport(evt, config, level, noAttach) {

  var self = this;

  this.className = this.constructor.name;

  // Set config if not set
  if (typeof config == 'string') {
    config = {filename: config}; // Accept filename as config
  } else if (typeof config == 'boolean') {
    config = {stdout: true}; // Accept boolean as config
  } else if (typeof config != 'object') {
    return;
  }
  
  // Set config
  this.config = config;
  
  // Create write stream for json filename
  if (config.filename) var stream = app.logger.getFileStream(config.filename);

  // Set write method
  this.write = function(log, data) {
    if (typeof log == 'object') {
      log = app.applyFilters(evt + '_json', log);
    } else {
      log = app.applyFilters(evt + '_json', {
        level: level,
        host: app.hostname,
        date: new Date().toGMTString(),
        msg: data[0]
      });
    }
    var json = JSON.stringify(log);
    if (stream) stream.write(json+'\n', 'utf8');
    if (config.stdout) console.log(json);
    for (var transport in self.otherTransports) {
      self.otherTransports[transport].write(json, data, log);
    }
  }

  if (!noAttach) app.on(evt, this.write);
  
}

JSONTransport.prototype.write = function(log, data) {
  // Interface
}

module.exports = JSONTransport;