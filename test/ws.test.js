const WebSocket = require('ws');
const waitUntil = require('async-wait-until');
const {get} = require('lodash');

const {startSwarm, killSwarm} = require('../utils/daemon/setup');
const {spliceConfigFile, resetConfigFile} = require('../utils/daemon/configs');

let socket, messages;

describe('web sockets interface', () => {

    describe('ping', () => {

        beforeEach(startSwarm);
        beforeEach('ws connection', done => {
            messages = [];
            socket = new WebSocket('ws://127.0.0.1:50000');
            socket.on('open', done);
            socket.on('message', message => messages.push(JSON.parse(message)));
        });

        afterEach( async () => {
            socket.close();
            await killSwarm();
        });

        it('should respond with pong', async () => {
            socket.send('{ "bzn-api" : "ping" }');
            await waitUntil(() => get(messages, '[0].bzn-api') === 'pong');
        })
    });

    describe('connection', () => {

        let startTime, timeElapsed;

        beforeEach(() => spliceConfigFile('bluzelle.json', 2, '\n  "ws_idle_timeout" : 1'));

        beforeEach(startSwarm);

        beforeEach('ws connection', done => {
            startTime = Date.now();

            socket = new WebSocket('ws://127.0.0.1:50000');
            socket.on('open', done);
        });

        afterEach(killSwarm);

        afterEach(() => resetConfigFile('bluzelle.json'));


        it('should close after an idle period', async function () {

            await new Promise((resolve, reject) => {

                socket.on('close', () => {
                    timeElapsed = Date.now() - startTime;

                    if (timeElapsed > 1000) {
                        resolve();
                    } else {
                        reject();
                    }
                });

            });
        });

        it('write should extend idle period before close', async function () {

            setTimeout(() => {
                socket.send('{"bzn-api" : "crud","cmd" : "create","data" :{"key" : "key0","value" : "I2luY2x1ZGUgPG1vY2tzL21vY2tfbm9kZV9iYXNlLmhwcD4NCiNpbmNsdWRlIDxtb2Nrcy9tb2NrX3Nlc3Npb25fYmFzZS5ocHA+DQojaW5jbHVkZSA8bW9ja3MvbW9ja19yYWZ0X2Jhc2UuaHBwPg0KI2luY2x1ZGUgPG1vY2tzL21vY2tfc3RvcmFnZV9iYXNlLmhwcD4NCg=="},"db-uuid" : "80174b53-2dda-49f1-9d6a-6a780d4cceca","request-id" : 85746}')
            }, 500);

            await new Promise((resolve, reject) => {

                socket.on('close', () => {
                    timeElapsed = Date.now() - startTime;

                    if (timeElapsed > 1500) {
                        resolve();
                    } else {
                        reject(`Socket closed in: ${timeElapsed}`);
                    }
                });
            });

        });

        it('read should extend idle period before close', async function () {

            setTimeout(() => {
                socket.send('{"bzn-api" : "crud","cmd" : "read","data" :{"key" : "key0"},"db-uuid" : "80174b53-2dda-49f1-9d6a-6a780d4cceca","request-id" : 85746}')
            }, 500);

            await new Promise((resolve, reject) => {

                socket.on('close', () => {
                    timeElapsed = Date.now() - startTime;

                    if (timeElapsed > 1500) {
                        resolve();
                    } else {
                        reject(`Socket closed in: ${timeElapsed}`);
                    }
                });
            });
        });

    });
});
