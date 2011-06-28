var assert    = require('assert'),
    http      = require('http'),
    util      = require('util'),
    vows      = require('vows'),
    rest      = require('restler'),
    help        = require('./help.js')
    webServer   = help.webServer,
    returnData  = help.returnData,
    redirectServer = help.redirectServer;

vows.describe('What the server sees with GET operations').addBatch(
{
    'An empty get' : {
        topic : function(){
            rest.get(webServer(this.callback));
        },
        'will GET /.' : function(request, response) {
            assert.strictEqual(request.method, 'GET');
            assert.strictEqual(request.url, '/');
        }
    },
    'A get to /asdf' : {
        topic : function(){
            rest.get(webServer(this.callback) + '/asdf');
        },
        'will GET /asdf.' : function(request, response) {
            assert.strictEqual(request.method, 'GET');
            assert.strictEqual(request.url, '/asdf');
        }
    },
    'A get with paramaters in the uri' : {
        topic : function(){
            rest.get(webServer(this.callback) + '/asdf?param1=one&param2=two');
        },
        'will pass the paramaters.' : function(request, response) {
            assert.strictEqual(request.url, '/asdf?param1=one&param2=two');
        }
    },
    'A get with paramaters in options.query' : {
        topic : function(){
            rest.get(webServer(this.callback) + '/asdf',{
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
    'A get with paramaters in options.headers' : {
        topic : function(){
            rest.get(webServer(this.callback) + '/asdf',{
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
    'A get with overriding paramaters in options.headers' : {
        topic : function(){
            rest.get(webServer(this.callback) + '/asdf',{
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
    'A get with options.username and options.password' : {
        topic : function(){
            rest.get(webServer(this.callback) + '/asdf',{
                'username' : 'danwrong',
                'password' : 'flange'
            });
        },
        'will send basic auth.' : function(request, response) {
            assert.ok('authorization' in request.headers);
            assert.strictEqual(request.headers.authorization, 'Basic ZGFud3Jvbmc6Zmxhbmdl');
        }
    },
    'A get with auth in the URL' : {
        topic : function(){
            rest.get((webServer(this.callback) + '/asdf').replace(
                'http://', 
                'http://danwrong:flange@')
            );
        },
        'will send basic auth.' : function(request, response) {
            assert.ok('authorization' in request.headers);
            assert.strictEqual(request.headers.authorization, 'Basic ZGFud3Jvbmc6Zmxhbmdl');
        }
    }
}).export(module);
