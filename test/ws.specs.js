// const WebSocket = require('ws');
// const waitUntil = require('async-wait-until');
// const {logFileExists, logFileMoved} = require('../utils.js');
// const {get} = require('lodash');
// const {exec}  = require('child_process');
//
// let socket, messages, logFileName;
//
// describe('web sockets interface', () => {
//
//     beforeEach( async done => {
//         exec('cd ../../; yarn run-daemon');
//         await waitUntil(() => logFileName = logFileExists());
//
//         messages = [];
//         socket = new WebSocket('ws://localhost:49152');
//         socket.on('open', done);
//         socket.on('message', message => messages.push(JSON.parse(message)));
//     });
//
//     describe('ping', () => {
//         it('should respond with pong', async () => {
//             socket.send('{ "bzn-api" : "ping" }');
//             await waitUntil(() => get(messages, '[0].bzn-api') === 'pong');
//         })
//     });
//
//     afterEach( async () => {
//         socket.close();
//         exec('cd ../../; yarn daemon-kill');
//         await waitUntil( () => logFileMoved(logFileName));
//     });
// });
