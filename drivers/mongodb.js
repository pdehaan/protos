         
/* MongoDB */

var _ = require('underscore'),
    util = require('util'),
    mongodb = require('mongodb'),
    slice = Array.prototype.slice,
    Db = mongodb.Db,
    Server = mongodb.Server,
    ObjectID = mongodb.ObjectID,
    Collection = mongodb.Collection;

function MongoDB(app, config) {

  /** config: {
    host: 'localhost',
    port: 27017,
    database: 'db_name',
    cachePrefix: null,
    storage: 'redis'
    } */

    var self = this;

    config = corejs.extend({
      host: 'localhost',
      port: 27017,
      database: 'default',
      cachePrefix: null,
      storage: null
    }, config || {});
    
    this.className = this.constructor.name;
    this.app = app;
    this.config = config;

    corejs.async(app); // Register async queue
    
    var reportError = function(err) {
      app.log(util.format("MongoDB [%s:%s] %s", config.host, config.port, err.code));
      self.client = err;
      corejs.done(app); // Flush async queue
    }
    
    corejs.util.checkPort(config.port, function(err) {

      if (err) {
        reportError(err);
      } else {
        // Set db
        self.db = new Db(config.database, new Server(config.host, config.port, {}));
        
        // Get client
        self.db.open(function(err, client) {
          if (err) {
            reportError(err);
          } else {
            // Set client
            self.client = client;
             
            // Set storage
            if (typeof config.storage == 'string') {
              self.storage = app._getResource('storages/' + config.storage);
            } else if (config.storage instanceof corejs.lib.storage) {
              self.storage = config.storage;
            }

            // Set caching function
            if (self.storage != null) {
              enableCollectionCache.call(self, client);
              self.setCachePrefix(config.cachePrefix || null);
            } else {
              // Use native count method for __count
              Collection.prototype.__count = Collection.prototype.count;
            }
            
            corejs.done(app); // Flush async queue
          }
        });

      }
      
    });
    
    // Only set important properties enumerable
    corejs.util.onlySetEnumerable(this, ['className', 'db']);
}

util.inherits(MongoDB, corejs.lib.driver);

/**
  Inserts values into a collection

  @example

    mongodb.insertInto({
      collection: 'users',
      values: {user: 'hello', pass: 'passme'}
    }, function(err, docs) {
      console.log([err, docs]);
    });

  @param {object} o 
  @param {function} callback
  @public
 */

MongoDB.prototype.insertInto = function(o, callback) {
  var self = this,
      collection = o.collection,
      values = o.values;
  
  if (!values) {
    callback.call(self, new Error("MongoDB::insertInto: 'values' is missing"));
    return;
  }
  
  this.client.collection(collection, function(err, collection) {
    if (err) callback.call(self, err);
    else {
      self.addCacheData(o, values);
      collection.insert(values, function(err, docs) {
        callback.call(self, err, docs);
      });
    }
  });
}

/**
  Updates items where condition is satisfied

  @example
  
    mongodb.updateWhere({
      collection: 'users',
      condition: {user: 'user1},
      multi: true,
      values: {pass: 'pass1'}
    }, function(err) {
      console.log(err);
    });

  @param {object} o
  @param {function} callback
  @public
 */

MongoDB.prototype.updateWhere = function(o, callback) {
  var self = this,
      collection = o.collection || '',
      condition = o.condition,
      multi = (typeof o.multi == 'undefined') ? true : (o.multi || false), // Ensure boolean
      values = o.values || {};
      
  if (!o.condition) {
    callback.call(self, new Error("MongoDB::queryWhere: 'condition' is missing"));
    return;
  }
  
  this.client.collection(collection, function(err, collection) {
    if (err) callback.call(self, err);
    else {
      collection.count(condition, function(err, count) {
        if (err) callback.call(self, err);
        else {
          self.addCacheData(o, condition);
          collection.update(condition, {$set: values}, {multi: multi, upsert: false}, function(err) {
            // Note: upsert is set to false, to provide predictable results
            callback.call(self, err || null);
          });
        }
      });
    }
  });
}

/**
  Updates items by ID

  @example
  
    mongodb.updateById({
      _id: 1,
      collection: 'users',
      values: {pass: 'pass1'}
    }, function(err) {
      console.log(err);
    });

    mongodb.updateById({
      _id: [1, 2],
      collection: 'users',
      values: {pass: 'pass1'}
    }, function(err) {
      console.log(err);
    });

  @param {object} o
  @param {function} callback
  @public
*/

MongoDB.prototype.updateById = function(o, callback) {
  var self = this, 
      collection = o.collection || '',
      values = o.values || {};
      
  if (typeof o._id == 'undefined') {
    callback.call(self, new Error("MongoDB::updateById: '_id' is missing"));
    return;
  }
  
  var condition = constructIdCondition(o._id);
  
  // Enable caching on method
  self.addCacheData(o, condition);
  
  this.updateWhere({
    collection: collection,
    condition: condition,
    multi: o.multi,
    values: values
  }, callback);
  
}

/**
  Deletes items where condition is satisfied

  @example
  
    mongodb.deleteWhere({
      collection: 'users',
      condition: {user: 'user1}
    }, function(err) {
      console.log(err);
    });

  @param {object} o
  @param {function} callback
  @public
 */

MongoDB.prototype.deleteWhere = function(o, callback) {
  var self = this,
      collection = o.collection || '',
      condition = o.condition;
      
  if (!condition) {
    callback.call(self, new Error("MongoDB::deleteWhere: 'condition' is missing"));
    return;
  }
  
  this.client.collection(collection, function(err, collection) {
    if (err) callback.call(self, err);
    else {
      self.addCacheData(o, condition);
      collection.remove(condition, function(err) {
        if (err) callback.call(self, err);
        else callback.call(self, null);
      });
    }
  });
}

/**
  Deletes records by ID

  @example
  
    mongodb.deleteById({
      _id: 1,
      collection: 'users'
    }, function(err) {
      console.log(err);
    });

    mongodb.deleteById({
      _id: [1, 2],
      collection: 'users'
    }, function(err) {
      console.log(err);
    });

  @param {object} o 
  @param {function} callback
  @public
 */

MongoDB.prototype.deleteById = function(o, callback) {
  var self = this, 
      collection = o.collection || '';
      
  if (!o._id) {
    callback.call(self, new Error("MongoDB::deleteById: '_id' is missing"));
    return;
  }
  
  var args = {
    collection: collection,
    condition: constructIdCondition(o._id)
  }
  
  // Enable caching on method
  self.addCacheData(o, args);
  
  this.deleteWhere(args, callback);
}

/**
  Queries documents where condition is satisfied

  @example
  
    mongodb.queryWhere({
      collection: 'users',
      condition: {'user': 'user1},
      fields: {'user': 1, 'pass': 1}
    }, function(err, docs) {
      console.log([err, docs]);
    });

  @param {object} o
  @param {function} callback
  @public
 */

MongoDB.prototype.queryWhere = function(o, callback) {
  var self = this,
      collection = o.collection || '',
      fields = o.fields || {},
      condition = o.condition,
      _id = (condition && condition._id);
      
  if (!condition) {
    callback.call(self, new Error("MongoDB::queryWhere: 'condition' is missing"));
    return;
  }

  // If _id is passed other conditions will be ignored
  if (_id != null) condition = constructIdCondition(_id);

  this.client.collection(collection, function(err, collection) {
    if (err) callback.call(self, err);
    else {
      self.addCacheData(o, condition);
      collection.__find(condition, fields, function(err, docs) {
        callback.call(self, err, docs);
      });
    }
  });
};

/**
  Queries documents by ID

  @example
  
    mongodb.queryById({
      _id: 1,
      collection: 'users',
      fields: {'user': 1, 'pass': 1}
    }, function(err, docs) {
      console.log([err, docs]);
    });

    mongodb.queryById({
      _id: [1, 2],
      collection: 'users',
      fields: {'user': 1, 'pass': 1}
    }, function(err, docs) {
      console.log([err, docs]);
    });

  @param {object} o
  @param {function} callback
  @public
 */

MongoDB.prototype.queryById = function(o, callback) {
  var self = this,
      collection = o.collection || '',
      fields = o.fields || {};
  
  if (typeof o._id == 'undefined') {
    callback.call(self, new Error("MongoDB::queryById: '_id' is missing"));
    return;
  }
    
  var condition = constructIdCondition(o._id);
  
  this.client.collection(collection, function(err, collection) {
    if (err) callback.call(self, err);
    else {
      self.addCacheData(o, condition);
      collection.__find(condition, fields, function(err, docs) {
        callback.call(self, err, docs);
      });
    }
  });
};

/**
  Queries all documents in a collection

  @example

    mongodb.queryAll({
      collection: 'users',
      fields: {'user': 1, 'pass': 1}
    }, function(err, docs) {
      console.log([err, docs]);
    });

  @param {object} o
  @param {function} callback
  @public
 */

MongoDB.prototype.queryAll = function(o, callback) {
  var self = this,
      collection = o.collection || '',
      fields = o.fields || {};

  var args = {
    collection: collection,
    fields: fields,
    condition: {}
  }
  
  // Enable caching on method
  self.addCacheData(o, args);
  
  this.queryWhere(args, callback);
};

/**
  Queries documents by ID, returning an object with the ID's as keys,
  which contain the document (if found), or null if the document is not found.

  @example
  
    mongodb.idExists({
      _id: 1,
      collection: 'users'
    }, function(err, docs) {
      console.log([err, docs]);
    });
    
    mongodb.idExists({
      _id: [1, 2],
      collection: 'users',
      fields: {user: 1, pass: 1}
    }, function(err, docs) {
      console.log([err, docs]);
    });
  
  @param {object} o
  @param {function} callback
  @public
 */

MongoDB.prototype.idExists = function(o, callback) {
  var self = this,
      collection = o.collection || '',
      fields = o.fields || {},
      _id = o._id;
      
  if (typeof _id == 'undefined') {
    callback.call(self, new Error("MongoDB::idExists: '_id' is missing"));
    return;
  }
  
  var args = {
    collection: collection,
    fields: fields,
    _id: _id
  }
  
  // Enable caching on method
  self.addCacheData(o, args);
  
  this.queryById(args, function(err, docs) {
    if (err) callback.call(self, err, {});
    else {
      var out = {}, doc, id, i;
      
      // Store found docs
      for (i=0; i < docs.length; i++) {
        doc = docs[i];
        out[doc._id.toString()] = doc;
      }
      
      // Set missing docs as null
      for (i=0; i < _id.length; i++) {
        id = _id[i];
        if (! (id in out)) out[id] = null;
      }
      
      callback.call(self, null, out);
      
    }
  });
};

/**
  Counts all documents in a collection

  @example

    mongodb.count({
      collection: 'users'
    }, function(err, count) {
      console.log([err, count]);
    });

  @param {object} o
  @param {function} callback
  @public
 */

MongoDB.prototype.count = function(o, callback) {
  var self = this,
      collection = o.collection || '';

  this.client.collection(collection, function(err, collection) {
    if (err) callback.call(self, err);
    else {
      var cdata = {};
      self.addCacheData(o, cdata);
      collection.__count(cdata, function(err, count) {
        callback.call(self, err, count);
      });
    }
  });
}

/**
  Converts `_id` to `id` when generating model objects,
  to conform with the Model API.
  
  Used internally by the model.
  
  @private
 */
 
MongoDB.prototype.idFilter = function(o) {
  if ('_id' in o) {
    o.id = o._id;
    delete o._id;
  }
}

// Model methods. See lib/driver.js for Model API docs

MongoDB.prototype.__modelMethods = {

  /** Model API insert */

  insert: function(o, cdata, callback) {
    var self = this;

    // Process callback & cache Data
    if (typeof callback == 'undefined') { callback = cdata; cdata = {}; }

    // Validate, throw error on failure
    this.validateProperties(o);
    
    // Convert object types to strings
    this.convertTypes(o);
    
    // Set model defaults
    this.setDefaults(o);
    
    // Convert `id` to `_id`
    convertMongoID(o);
    
    // Save data into the database
    this.driver.insertInto(_.extend({
      collection: this.context,
      values: o
    }, cdata), function(err, docs) {
      if (err) callback.call(self, err, null);
      else {
        callback.call(self, null, docs[0]._id);
      }
    });
  },


  /** Model API get */

  get: function(o, cdata, callback) {
    var self = this;

    // Process callback & cache data
    if (typeof callback == 'undefined') { callback = cdata; cdata = {}; }

    if (typeof o == 'number' || typeof o == 'string' || o instanceof ObjectID) { 
      // If `o` is number: Convert to object
      o = {_id: o};
    } else if (o instanceof Array) {

      // If `o` is an array of params, process args recursively using multi
      var arr = o, 
          multi = this.multi();
      for (var i=0; i < arr.length; i++) {
        multi.get(arr[i], cdata);
      }
      multi.exec(function(err, docs) {
        callback.call(self, err, docs);
      });
      return;

    } else if (o.constructor === Object) {
      
      // IF `o` is object: Validate without checking required fields
      this.propertyCheck(o);

    } else {

      callback.call(self, new Error(util.format("%s: Wrong value for `o` argument", this.className)), null);
      return;

    }
    
    // TODO: automatically detect which fields should be retrieved based
    // on this.properties
    
    this.driver.queryWhere(_.extend({
      collection: this.context,
      condition: o,
      fields: {}
    }, cdata), function(err, docs) {
      if (err) callback.call(self, err, null);
      else {
        if (docs.length === 0) callback.call(self, null, null);
        else {
          var model = self.createModel(docs[0]);
          callback.call(self, null, model);
        }
      }
    });
  },

  /** Model API getAll */

  getAll: function(cdata, callback) {
    var self = this, models = [];

    // Process callback & cache data
    if (typeof callback == 'undefined') { callback = cdata; cdata = {}; }

    this.driver.queryAll(_.extend({
      collection : this.context
    }, cdata), function(err, docs) {
      if (err) callback.call(self, err, null);
      else {
        for (var i=0; i < docs.length; i++) {
          models.push(self.createModel(docs[i]));
        }
        callback.call(self, null, models);
      }
    });

  },

  /** Model API save */

  save: function(o, cdata, callback) {
    var self = this;

    // Process callback & cache data
    if (typeof callback == 'undefined') { callback = cdata; cdata = {}; }

    // Note: Validation has already been performed by ModelObject
    
    // Convert `id` to `_id`
    convertMongoID(o);
    
    // Get _id, and prepare update data
    var _id = o._id;
    delete o._id;
    
    if (typeof _id == 'undefined') {
      callback.call(this, new Error("Unable to update model object without ID"));
      return;
    }
     
    this.driver.updateById(_.extend({
      _id: _id,
      collection: this.context,
      values: o
    }, cdata), function(err, docs) {
      callback.call(self, err);
    });
  },


  /** Model API delete */

  delete: function(id, cdata, callback) {
    var self = this;

    // Process callback & cache data
    if (typeof callback == 'undefined') { callback = cdata; cdata = {}; }

    if (typeof id == 'number' || id instanceof String || id instanceof Array || id instanceof ObjectID) {

      this.driver.deleteById(_.extend({
        collection: this.context,
        _id: id
      }, cdata), function(err) {
        callback.call(self, err);
      });
      
    } else {
      callback.call(self, new Error(util.format("%s: Wrong value for `id` parameter", this.className)));
    }
  }
}

/**
  Enables collection cache in collection objects
  
  The Client::collection method is overridden to support
  implement caching via the Driver's internals.
 */

function enableCollectionCache(client) {
  var self = this,
      app = self.app,
      collectionCache = {},
      _collection = client.collection;

  // Override client.collection to support cache
  client.collection = function() {
    var args = slice.call(arguments, 0),
        cname = args[0],
        callback = args.pop();
    
    if (cname in collectionCache) {
      // Collection is cached
      app.debug('Returning cached collection: ' + cname);
      callback(null, collectionCache[cname]);
    }  else {
      // Collection not cached
      args.push(function(err, collection) {
        if (err) {
          callback(err, null);
        } else {
          app.debug('Generating new cache for collection: ' + cname);
          // Enable caching with Collection::__count
          collection.__count = __count;
          // Cache collection object
          collectionCache[cname] = collection; 
          // Enable caching in collection object
          self.cacheClientMethods(collection, 'insert', 'count', 'update', 'remove', '__count', '__find');
          // Run callback with collection
          callback(null, collection);          
        }
      });
      // Get collection
      _collection.apply(client, args);
    }
  }
}

/**
  Construct Id condition 

  Provides: {object} condition

  @param {number || string || array (string || number) } _id 
  @private
*/

function constructIdCondition(_id) {
  if (typeof _id === 'number' || _id instanceof ObjectID || _id.constructor === Object) {
    // Number or ObjectID/Object instance » Return as is
    return {_id: _id};
  } else if (typeof _id === 'string') {
    // String » Convert to Object ID
    return {_id: new ObjectID(_id)};
  } else if (_id instanceof Array) {
    // Array » Return $in condition
    for (var id, $in=[], i=0; i < _id.length; i++) {
      id = _id[i];
      if (typeof id == 'number' || id instanceof ObjectID) {
        $in.push(id);
      } else if (typeof id == 'string') {
        $in.push(new ObjectID(id));
      }
    }
    return {_id: {$in: $in}};
  }
}

/**
  Converts an 'id' param to an _id param
  
  @private
 */
 
function convertMongoID(o) {
  if ('id' in o) {
    o._id = o.id;
    delete o.id;
  }
}

/**
  Count method that supports caching
  
  @param {object} cdata: Cache data
  @param {function} callback
  @public
 */

function __count(cdata, callback) {
  // This function is overridden, and the cdata var is used for caching
  var self = this;
  this.count(function(err, count) {
    callback.call(self, err, count);
  });
}

/**
  Quick find method without cursors
  
 */

Collection.prototype.__find = function() {
  var self = this,
      args = slice.call(arguments, 0),
      callback = args.pop();
  args.push(function(err, cursor) {
    if (err) callback.call(self, err);
    else {
      cursor.toArray(function(err, docs) {
        callback.call(self, err, docs);
      });
    }
  });
  this.find.apply(this, args);
}

module.exports = MongoDB;