var assert      = require('assert'),
    http        = require('http'),
    util        = require('util'),
    vows        = require('vows'),
    rest        = require('restler'),
    help        = require('./help.js')
    webServer   = help.webServer,
    returnData  = help.returnData,
    redirectServer = help.redirectServer;

vows.describe('How Service works').addBatch(
{
    'A Service with a baseURL' : {
        topic : function () {
            var baseURL = webServer(this.callback);
            (new rest.Service(baseURL)).get('/asdf');
        },
        'will append the path onto baseURL.' : function(request, response) {
            assert.strictEqual(request.url, '/asdf');
        }
    },
    'Service defaults' : {
        topic : function () {
            var baseURL = webServer(this.callback);
            (new rest.Service(
                baseURL, {
                    'headers' : {
                        'User-Agent' : 'AnythingElse'
                    }
                }
            )).get('/asdf');
        },
        'will will override.' : function(request, response) {
            assert.ok('user-agent' in request.headers);
            assert.strictEqual(request.headers['user-agent'], 'AnythingElse');
        }
    },
    'Services with a custom Request object' : {
        topic : function () {
            var baseURL = webServer(this.callback);
            
            (new rest.Service(
                baseURL, {
                    'headers' : {
                        'User-Agent' : 'AnythingElse'
                    }
                },
                rest.customRequest({
                    _applyAuth : function () {
                        this.headers.specialauth = 'SpecialAuthValue';
                    }
                })
            )).get('/asdf');
        },
        'will will override.' : function(request, response) {
            assert.ok('user-agent' in request.headers);
            assert.ok('specialauth' in request.headers);
            assert.strictEqual(request.headers['user-agent'], 'AnythingElse');
            assert.strictEqual(request.headers.specialauth, 'SpecialAuthValue');
        }
    }
}).export(module);
