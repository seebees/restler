var util       = require('util'),
    http      = require('http'),
    https     = require('https'),
    url       = require('url'),
    qs        = require('querystring'),
    multipart = require('./multipartform'),
    /**
     * Nice function to apply the properties of source to target
     */
    mixin     = function (target, source) {
      Object.keys(source).forEach(function(key) {
        target[key] = source[key];
      });
      
      return target;
    },
    /**
     * simple function to put the whole implementation in one place
     * it wraps util.inherits()
     * @param parent        the parent (first for readability)
     * @param child         the constructor function
     * @param prototype     an object literal to append to child.prototype
     */
    inherit = function(parent, child, prototype ) {
        var i;
        if ( typeof child !== 'function' ) {
            if (typeof child === 'object' ) {
                prototype = child;
            }
            child = function () {
                parent.apply(this, arguments);
            };
        }
        util.inherits(child, parent);
        child.prototype = mixin(child.prototype, prototype);
        
        return child;
    },
    /**
     * An object to store authentication options
     * A request object should be able to be created to use
     * any give authentication
     */
    authentication = {
        basic : function () {
            var authParts;
            
            if (this.url.auth) {
              authParts = this.url.auth.split(':');
              this.options.username = authParts[0];
              this.options.password = authParts[1];
            }
            
            if (this.options.username && this.options.password) {
              var b = new Buffer([this.options.username, this.options.password].join(':'));
              this.headers['Authorization'] = "Basic " + b.toString('base64');
            }
        }
    },
    /**
     * The base request object.  All requests funnel through here
     * A new Request() is an EventEmitter that will emit all manner of
     * wonderful events but especially, success and complete
     */
    Request = inherit(
        //parent
        process.EventEmitter,
        //constructor
        function (uri, options) {
            var self = this,
                proto;
            
            process.EventEmitter.call(self);
            self.url = url.parse(uri || '');
            self.options = options || {};
            self.headers = {
              'Accept': '*/*',
              'User-Agent': 'Restler for node.js',
              'Host': self.url.host
            };
            
            mixin(self.headers, self.options.headers || {});
            
            // set port and method defaults
            if (!self.url.port) {
                self.url.port = (self.url.protocol == 'https:') ? '443' : '80';
            }
            if (!self.options.method) {
                self.options.method = (self.options.data) ? 'POST' : 'GET';
            }
            if (typeof self.options.followRedirects === 'undefined') {
                self.options.followRedirects = true;
            }
            if (typeof self.options.parser === 'undefined') {
                self.options.parser = parsers.auto;
            }
            
            // stringify query given in options of not given in URL
            if (self.options.query && !self.url.query) {
              if (     typeof self.options.query === 'object') { 
                  self.url.query = qs.stringify(self.options.query);
              }
              else if (typeof self.options.query === 'string') { 
                  self.url.query = self.options.query;
              }
            }
            
            if (self.options.multipart) {
                self.headers['Content-Type'] = 'multipart/form-data; boundary=' + multipart.defaultBoundary;
            } else if (typeof self.options.data == 'object') {
                self.options.data = qs.stringify(this.options.data);
                self.headers['Content-Type'] = 'application/x-www-form-urlencoded';
                self.headers['Content-Length'] = this.options.data.length;
            }
            /*TODO clearly we should be looking at options and selecting the
             * appropriate Authentication.function or running _applyAuth() if
             * the function exists
             */
            self._applyAuth();
            
            proto = (self.url.protocol == 'https:') ? https : http;
            
            self._request = proto.request({
                    host    : self.url.hostname,
                    port    : self.url.port,
                    path    : self._fullPath(),
                    method  : self.options.method,
                    headers : self.headers
                }).on('response', function(response) {
                    self._responseHandler(response);
                }).on('error', function(err) {
                    self._respond('error', null, err);
                }
            );
      },
      //additional methods
      {
          _isRedirect: function(response) {
              return ([301, 302].indexOf(response.statusCode) >= 0);
          },
          _fullPath: function() {
              var path = this.url.pathname || '/';
              if (this.url.hash) path += this.url.hash;
              if (this.url.query) path += '?' + this.url.query;
              return path;
          },
          _applyAuth: authentication.basic,
          _responseHandler: function(response) {
              var self = this;
              
              if (self._isRedirect(response) && self.options.followRedirects == true) {
                try {
                  var location = url.resolve(self.url, response.headers['location']);
                  
                  //protect against some kind of crazy chain
                  if (!self.options.originalRequest) {
                      self.options.originalRequest = self;
                      self.options.originalRequest.redirect_count = 1;
                  } else if (self.options.originalRequest.redirect_count > 10) {
                      //arbitrarily stop at 10.  I mean really... 10 redirects?
                      self._respond('error', '', 'Failed to follow redirect over 10 redirects');
                  }
                  
                  self.request(location, this.options);
                } catch(e) {
                  self._respond('error', '', 'Failed to follow redirect');
                }
              } else {
                var body = '';
                
                // TODO Handle different encodings
                response.setEncoding('utf8');
                
                response.on('data', function(chunk) {
                  body += chunk;
                }).on('end', function() {
                   if (self.options.parser) {
                     self.options.parser.call(response, body, function(parsedData) {
                       self._fireEvents(parsedData, response);
                     });
                   } else {
                     self._fireEvents(body, response);
                   }
                });
              }
          },
          _respond: function(type, data, response) {
              if (this.options.originalRequest) {
                this.options.originalRequest.emit(type, data, response);
              } else {
                this.emit(type, data, response);
              }
          },
          _fireEvents: function(body, response) {
              //TODO 404 is not necessary a bad thing
              if (parseInt(response.statusCode) >= 400) {
                  this._respond('error', body, response);
              } else {
                  this._respond('success', body, response);
              }
                  
              this._respond(response.statusCode.toString().replace(/\d{2}$/, 'XX'), body, response);
              this._respond(response.statusCode.toString(), body, response);
              this._respond('complete', body, response);
          },
          run: function() {
              var self = this;
              
              if (self.options.multipart) {
                multipart.write(self._request, self.options.data, function() {
                  self._request.end();
                });
              } else {
                if (self.options.data) {
                  self._request.write(self.options.data.toString(), self.options.encoding || 'utf8');
                }
                    self._request.end();
              }
              
              return self;
          }
    }),
    /**
     * specific parsers for different content-types
     * to implement an additional parser simple apply a function to
     * the content type that accepts data, callback
     */
    parsers = {
        auto: function(data, callback) {
            var contentType = this.headers['content-type'];
            if (    contentType 
                 && contentType in parsers
                 && typeof parsers[contentType] === 'function'
            ) {
              return parsers[contentType].call(this, data, callback);
            } else {
                return callback(data);
            }
        },
        'application/json': function(data, callback) {
            callback(data && JSON.parse(data));
        },
        'application/yaml' : (function(){
            try {
                var yaml = require('yaml');
                
                return function(data, callback) {
                  return callback(data && yaml.eval(data));
                };
            } catch(e) {
                return false;
        }
        }()),
        'application/xml' : (function(){
            try {
                var xml2js = require('xml2js');
                 return function(data, callback) {
                  if (data) {
                    var parser = new xml2js.Parser();
                    
                    parser.on('end', function(result) {
                        callback(result);
                    });
                    
                    parser.parseString(data);
                  } else {
                    callback();
                  }
                };
              } catch(e) {
                  return false;
              }
        }())
    },
    /**
     * The base static entrypoint for the whole kit and kaboodle.
     * the instance only exposes 4 methods (get, put, post, del).
     * Each method is pure and can be copied off and put wherever you like.
     * If you want a new Service with a special Request object that implements
     * a special Authentication scheme for example, inherit from Request,
     * change the ._applyAuth function on your class enjoy.
     * See the tests for details
     */
    Service = function (baseURL, defaults, ServiceRequest) {
        var resolve = function (path) {
                return baseURL ?
                    url.resolve(baseURL, path) :
                    path;
            },
            withDefaults = function (options, method) {
                options = options || {};
                options.method = method;
                return mixin(
                    Object.create(defaults), 
                    options
                );
            },
            actions = {
                request: function(path, options) {
                    var aRequest = new ServiceRequest(resolve(path), options);
                    //expose the implementation again so people can chain if they like
                    //right now we are stopmping on the internal request object
                    mixin(aRequest, actions);
                    return aRequest.run();
                },
                del: function(path, options) {
                    return actions.request(
                        resolve(path),
                        withDefaults(options, 'DELETE')
                    );
                }
            };

        //Append get, put, post our implementation
        ['get','put','post'].forEach(function(func){
            actions[func] = function(path, options) {
                return actions.request(
                    resolve(path),
                    withDefaults(options, func)
                );
            };
        });
        
        //The ServiceRequest must inherit from Request
        if (!(    typeof ServiceRequest === 'function'
             && Request.prototype.isPrototypeOf(ServiceRequest.prototype))
         ) {
            ServiceRequest = Request;
        }
        //defaults must have a rational default value
        defaults = defaults || {};
        
        //expose
        mixin(this, actions);
    },
    /**
     * Shorthand for creating new Services
     */
    service = function (constructor, defaults, methods, ServiceRequest) {
        var baseURL;
        if ( defaults && typeof defaults.baseURL === 'string' ) {
            baseURL = defaults.baseURL;
            delete defaults.baseURL
        }
        //TODO there is an instanceof problem here.  These new Services
        //will be an instanceof Service but not an instanceof constructor
        
        constructor.prototype = new Service(baseURL, defaults || {}, ServiceRequest);
        mixin(constructor.prototype, methods);
        return constructor;
    };

//Export the basic REST functions
module.exports = new Service();

//Export helper functions and Classes so people can customize 
mixin(module.exports, {
  Request: Request,
  Service: Service,
  service: service,
  parsers: parsers,
  authentication : authentication,
  file: multipart.file,
  data: multipart.data
});

