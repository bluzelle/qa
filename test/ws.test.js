const WebSocket = require('ws');
const waitUntil = require('async-wait-until');
const {startSwarm, killSwarm} = require('../utils/swarmSetup');
const {get} = require('lodash');

let socket, messages, logFileName;

describe('web sockets interface', () => {

    beforeEach(startSwarm);
    beforeEach('ws connection', done => {
        messages = [];
        socket = new WebSocket('ws://127.0.0.1:50000');
        socket.on('open', done);
        socket.on('message', message => messages.push(JSON.parse(message)));
    });

    describe('ping', () => {
        it('should respond with pong', async () => {
            socket.send('{ "bzn-api" : "ping" }');
            await waitUntil(() => get(messages, '[0].bzn-api') === 'pong');
        })
    });

    afterEach( async () => {
        socket.close();
        killSwarm();
    });
});
