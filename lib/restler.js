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
            process.EventEmitter.call(this);
            
            this.url = url.parse(uri);
            this.options = options;
            this.headers = {
              'Accept': '*/*',
              'User-Agent': 'Restler for node.js',
              'Host': this.url.host
            }
            
            mixin(this.headers, options.headers || {});
            
            // set port and method defaults
            if (!this.url.port) this.url.port = (this.url.protocol == 'https:') ? '443' : '80';
            if (!this.options.method) this.options.method = (this.options.data) ? 'POST' : 'GET';
            if (typeof this.options.followRedirects == 'undefined') this.options.followRedirects = true;
            if (typeof this.options.parser === 'undefined') {
                this.options.parser = parsers.auto;
            }
            
            // stringify query given in options of not given in URL
            if (this.options.query && !this.url.query) {
              if (typeof this.options.query == 'object') 
                this.url.query = qs.stringify(this.options.query);
              else this.url.query = this.options.query;
            }
            
            if (this.options.multipart) {
              this.headers['Content-Type'] = 'multipart/form-data; boundary=' + multipart.defaultBoundary;
            } else {
              if (typeof this.options.data == 'object') {
                this.options.data = qs.stringify(this.options.data);
                this.headers['Content-Type'] = 'application/x-www-form-urlencoded';
                this.headers['Content-Length'] = this.options.data.length;
              }
            }
            /*TODO clearly we should be looking at options and selecting the
             * appropriate Authentication.function or running _applyAuth() if
             * the function exists
             */
            this._applyAuth();
            
            var proto = (this.url.protocol == 'https:') ? https : http;
            
            this._request = proto.request({
              host: this.url.hostname,
              port: this.url.port,
              path: this._fullPath(),
              method: this.options.method,
              headers: this.headers
            });
            
            this._makeRequest();
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
              
              if (this._isRedirect(response) && this.options.followRedirects == true) {
                try {
                  var location = url.resolve(this.url, response.headers['location']);
                  this.options.originalRequest = this;
                  
                  this.request(location, this.options);
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
              if (parseInt(response.statusCode) >= 400) this._respond('error', body, response);
              else this._respond('success', body, response);
                  
              this._respond(response.statusCode.toString().replace(/\d{2}$/, 'XX'), body, response);
              this._respond(response.statusCode.toString(), body, response);
              this._respond('complete', body, response);
          },
          _makeRequest: function() { 
              var self = this;
                 
              this._request.on('response', function(response) {
                    self._responseHandler(response);
              }).on('error', function(err) {
                self._respond('error', null, err);
              });
          },
          run: function() {
              var self = this;
              
              if (this.options.multipart) {
                multipart.write(this._request, this.options.data, function() {
                  self._request.end();
                });
              } else {
                if (this.options.data) {
                  this._request.write(this.options.data.toString(), this.options.encoding || 'utf8');
                }
                    this._request.end();
              }
              
              return this;
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
        
        //The internal Request object must be rational
        if (!(ServiceRequest instanceof Request)) {
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

