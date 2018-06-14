const spawn = require('child_process').spawn;
const expect = require('chai').expect;
const WebSocket = require('ws');

const {startSwarm, killSwarm, createState} = require('../utils/daemon/setup');
const {logFileExists, readFile} = require('../utils/daemon/logs');

let socket;

describe('daemon', () => {

    describe('on startup', () => {

        beforeEach(startSwarm);

        afterEach(killSwarm);

        it('should create a log', () => {
            expect(logFileExists()).to.have.string('.log')
        });
    });

    describe('persistent states', () => {

        beforeEach(createState);

        afterEach(async () => {
            socket.close();
            await killSwarm();
        });

        context('storage', () => {

            context('values', () => {

                beforeEach('open ws connection', async () => {
                    await startSwarm(true);
                    socket = new WebSocket('ws://127.0.0.1:50000');
                    await new Promise((resolve, reject) => {
                        socket.on('open', () => {
                            resolve()
                        });
                    });
                });

                it('should persist through shut down', async () => {
                    const messagePromise = new Promise(resolve =>
                        socket.on('message', message => resolve(JSON.parse(message))));

                    socket.send('{"bzn-api" : "crud","cmd" : "read","data" :{"key" : "key1"},"db-uuid" : "80174b53-2dda-49f1-9d6a-6a780d4cceca","request-id" : 85746}')

                    const message = await messagePromise;
                    expect(message.data.value).to.equal('hi');
                });
            });

            context('a new node, after connecting to peers', () => {

                const DAEMON_UUIDS = ["60ba0788-9992-4cdb-b1f7-9f68eef52ab9", "c7044c76-135b-452d-858a-f789d82c7eb7", "3726ec5f-72b4-4ce6-9e60-f5c47f619a41"];

                beforeEach(async () => {
                    await startSwarm(true);
                });

                it('should sync with swarm', done => {
                    const node = spawn('./run-daemon.sh', ['bluzelle3.json'], {cwd: './scripts'});

                    node.stdout.on('data', data => {
                        if (data.toString().includes('Create successful.')) {
                            done();
                        }
                    });
                });

                it('should fully replicate .state file of leader', done => {
                    const node = spawn('./run-daemon.sh', ['bluzelle3.json'], {cwd: './scripts'});

                    node.stdout.on('data', data => {

                        let daemonData = {};
                        let value;
                        let results = [];

                        if (data.toString().includes('Create successful.')) {

                            DAEMON_UUIDS.forEach(v => {
                                daemonData[v] = readFile('/output/.state/', v + '.dat');
                            });

                            for (let key in daemonData){
                                if (!value) {
                                    value = daemonData[key];
                                }

                                results.push(value === daemonData[key]);
                            }

                            if (results.every(v => v)) {
                                done()
                            }
                        }
                    });
                });
            });
        });
    });
});

