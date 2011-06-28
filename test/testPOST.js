var assert    = require('assert'),
    http      = require('http'),
    util      = require('util'),
    vows      = require('vows'),
    rest      = require('restler'),
    help        = require('./help.js')
    webServer   = help.webServer,
    returnData  = help.returnData,
    redirectServer = help.redirectServer;

vows.describe('What the server sees with POST operations').addBatch(
{
    'An empty post' : {
        topic : function(){
            rest.post(webServer(this.callback));
        },
        'will POST /.' : function(request, response) {
            assert.strictEqual(request.method, 'POST');
            assert.strictEqual(request.url, '/');
        }
    },
    'A post to /asdf' : {
        topic : function(){
            rest.post(webServer(this.callback) + '/asdf');
        },
        'will POST /asdf.' : function(request, response) {
            assert.strictEqual(request.method, 'POST');
            assert.strictEqual(request.url, '/asdf');
        }
    },
    'A post with paramaters in the uri' : {
        topic : function(){
            rest.post(webServer(this.callback) + '/asdf?param1=one&param2=two');
        },
        'will pass the paramaters.' : function(request, response) {
            assert.strictEqual(request.url, '/asdf?param1=one&param2=two');
        }
    },
    'A post with paramaters in options.query' : {
        topic : function(){
            rest.post(webServer(this.callback) + '/asdf',{
                'query' :{
                    'param1' : 'one',
                    'param2' : 'two'
                }
            });
        },
        'will serialize the paramaters into the uri.' : function(request, response) {
            assert.strictEqual(request.url, '/asdf?param1=one&param2=two');
        }
    },
    'A post with paramaters in options.headers' : {
        topic : function(){
            rest.post(webServer(this.callback) + '/asdf',{
                'headers' :{
                    'param1' : 'one',
                    'param2' : 'two'
                }
            });
        },
        'will set the headers.' : function(request, response) {
            assert.ok('param1' in request.headers);
            assert.ok('param2' in request.headers);
            assert.strictEqual(request.headers.param1, 'one');
            assert.strictEqual(request.headers.param2, 'two');
        }
    },
    'A post with overriding paramaters in options.headers' : {
        topic : function(){
            rest.post(webServer(this.callback) + '/asdf',{
                'headers' :{
                    'User-Agent' : 'Anyone Else'
                }
            });
        },
        'will override the default value.' : function(request, response) {
            assert.ok('user-agent' in request.headers);
            assert.strictEqual(request.headers['user-agent'], 'Anyone Else');
        }
    },
    'A post with options.username and options.password' : {
        topic : function(){
            rest.post(webServer(this.callback) + '/asdf',{
                'username' : 'danwrong',
                'password' : 'flange'
            });
        },
        'will send basic auth.' : function(request, response) {
            assert.ok('authorization' in request.headers);
            assert.strictEqual(request.headers.authorization, 'Basic ZGFud3Jvbmc6Zmxhbmdl');
        }
    },
    'A post with auth in the URL' : {
        topic : function(){
            rest.post((webServer(this.callback) + '/asdf').replace(
                'http://', 
                'http://danwrong:flange@')
            );
        },
        'will send basic auth.' : function(request, response) {
            assert.ok('authorization' in request.headers);
            assert.strictEqual(request.headers.authorization, 'Basic ZGFud3Jvbmc6Zmxhbmdl');
        }
    },
    'A post with options.data === String' : {
        topic : function(){
            var self = this;
            rest.post(webServer(function(request){
                var data = '';
                request.on('data',function(chunk){
                    data += chunk;
                }).on('end',function(){
                    self.callback(null, data);
                });
            }) + '/asdf', 
            {
                'data' : 'my data'
            });
        },
        'will have the data in the body.' : function(wtf, data) {
            assert.strictEqual(data, 'my data');
        }
    },
    'A post with options.data === Object' : {
        topic : function(){
            var self = this;
            rest.post(webServer(function(request){
                var data = '';
                request.on('data',function(chunk){
                    data += chunk;
                }).on('end',function(){
                    self.callback(null, data, request);
                });
            }) + '/asdf', 
            {
                'data' : {
                    'param1' : 'one',
                    'param2' : 'two'
                }
            });
        },
        'will serialize the object into the body.' : function(wtf, data, request) {
            assert.ok('content-type' in request.headers);
            assert.ok('content-length' in request.headers);
            assert.strictEqual(request.headers['content-type'], 'application/x-www-form-urlencoded');
            assert.strictEqual(request.headers['content-length'], '21');
            assert.strictEqual(data, 'param1=one&param2=two');
        }
    },
    'A post with simple multipart data' : {
        topic : function(){
            var self = this;
            rest.post(webServer(function(request){
                var data = '';
                request.on('data',function(chunk){
                    data += chunk;
                }).on('end',function(){
                    self.callback(null, data, request);
                });
            }) + '/asdf', 
            {
                'data' : {
                    'param1' : 'one',
                    'param2' : 1
                },
                'multipart' : true
            });
        },
        'will set the content type and push the data' : function(wtf, data, request) {
            assert.ok('content-type' in request.headers);
            assert.strictEqual(
                request.headers['content-type'], 
                'multipart/form-data; boundary=48940923NODERESLTER3890457293'
            );
            assert.strictEqual(
                data, 
                '--48940923NODERESLTER3890457293\r\nContent-Disposition: form-data; name="param1"\r\n\r\none\r\n--48940923NODERESLTER3890457293\r\nContent-Disposition: form-data; name="param2"\r\n\r\n1\r\n--48940923NODERESLTER3890457293--\r\n'
            );
        }
    }
}).export(module);

//

