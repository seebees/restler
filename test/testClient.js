var assert      = require('assert'),
    http        = require('http'),
    util        = require('util'),
    vows        = require('vows'),
    rest        = require('restler'),
    help        = require('./help.js')
    webServer   = help.webServer,
    returnData  = help.returnData,
    redirectServer = help.redirectServer;

vows.describe('What the client sees').addBatch(
{
    'A basic get' : {
        topic : rest.get(webServer(returnData('asdf')) + '/asdf'),
        'will return data and the response.' : function(wtf, data, response) {
            assert.strictEqual(data, 'asdf');
            assert.ok(response instanceof http.IncomingMessage);
        }
    },
    'A get without a path' : {
        topic : rest.get(webServer(returnData('asdf')) + '/asdf'),
        'will return data and the response.' : function(wtf, data, response) {
            assert.strictEqual(data, 'asdf');
            assert.ok(response instanceof http.IncomingMessage);
        }
    },
    'A basic put' : {
        topic : rest.put(webServer(returnData('asdf')) + '/asdf'),
        'will return data and the response.' : function(wtf, data, response) {
            assert.strictEqual(data, 'asdf');
            assert.ok(response instanceof http.IncomingMessage);
        }
    },
    'A basic post' : {
        topic : rest.post(webServer(returnData('asdf')) + '/asdf'),
        'will return data and the response.' : function(wtf, data, response) {
            assert.strictEqual(data, 'asdf');
            assert.ok(response instanceof http.IncomingMessage);
        }
    },
    'A basic del' : {
        topic : rest.del(webServer(returnData('asdf')) + '/asdf'),
        'will return data and the response.' : function(wtf, data, response) {
            assert.strictEqual(data, 'asdf');
            assert.ok(response instanceof http.IncomingMessage);
        }
    },
    'Giveing the auto parser JSON' : {
        topic : rest.get(webServer(returnData(
              '{ "ok": true }',{'Content-Type':'application/json'}))
        ),
        'will parse the JSON and return the object and response' : function(wtf, data, response) {
            assert.ok(typeof data === 'object');
            assert.ok('ok' in data);
            assert.ok(data.ok);
            assert.ok(response instanceof http.IncomingMessage);
        }
    },
    'Giveing the auto parser XML' : {
        topic : rest.get(webServer(returnData(
              '<document><ok>true</ok></document>',{'Content-Type':'application/xml'}))
        ),
        'will parse the XML and return the object and response' : function(wtf, data, response) {
            assert.ok(typeof data === 'object');
            assert.ok('ok' in data);
            assert.ok(data.ok);
            assert.ok(response instanceof http.IncomingMessage);
        }
    },
    'Giveing the auto parser YALM' : {
        topic : rest.get(webServer(returnData(
              'ok: true',{'Content-Type':'application/yaml'}))
        ),
        'will parse the YALM and return the object and response' : function(wtf, data, response) {
            assert.ok(typeof data === 'object');
            assert.ok('ok' in data);
            assert.ok(data.ok);
            assert.ok(response instanceof http.IncomingMessage);
        }
    },
    'A redirect' : {
        topic : rest.get(redirectServer([])),
        'will be followed' : function(wtf, data, response) {
            assert.strictEqual(data, 'Hell Yeah!');
        }
    },
    'A recursive set of redirects' : {
        topic : rest.get(redirectServer(['/areYouMyMommy','/thenSomeWhereElse','/what'])),
        'will be followed to the end' : function(wtf, data, response) {
            assert.strictEqual(data, 'Hell Yeah!');
        }
    }
    //TODO test for events 200-500
}).export(module);
