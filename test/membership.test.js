const {spawn, exec} = require('child_process');
const WebSocket = require('ws');
const waitUntil = require("async-wait-until");
const {includes, filter} = require('lodash');
const expect = require('chai').expect;

const api = require('../bluzelle-js/src/api');
const {fileExists, readFile, readDir, checkFilesConsistency} = require('../utils/daemon/logs');
const {startSwarm, killSwarm} = require('../utils/daemon/setup');
const {editConfigFile, resetConfigFile} = require('../utils/daemon/configs');

const DAEMON_UUIDS = ["60ba0788-9992-4cdb-b1f7-9f68eef52ab9", "c7044c76-135b-452d-858a-f789d82c7eb7"];


describe('swarm membership', () => {

    context('adding new peer', () => {

        const NEW_PEER = '{"host":"127.0.0.1","http_port":8083,"name":"new_peer","port":50003,"uuid":"7a55cc24-e4e3-4d88-86a6-3a501e09ee26"}'
        let logFileName;

        beforeEach('start swarm', startSwarm);
        beforeEach('open ws connection', done => {
            socket = new WebSocket('ws://127.0.0.1:50000');
            socket.on('open', () => {
                socket.send(`{"bzn-api":"raft","cmd":"add_peer","data":{"peer":${NEW_PEER}}}`);
                done();
            });
        });

        afterEach(async () => {
            await killSwarm();
        });

        context('swarm', () => {

            it('should append joint quorum to log', async () => {

                await waitUntil(() => logFileName = fileExists());

                await waitUntil(() => includes(readFile('output/', logFileName), 'Appending joint_quorum to my log'));
            });

            it('should persist joint quorum to .dat', async () => {

                await waitUntil(() => {
                    return readFile('output/.state/', DAEMON_UUIDS[0] + '.dat').split('\n').length > 2
                });

                const jointQuorumData = readFile('output/.state/', DAEMON_UUIDS[0] + '.dat').split('\n')[1].slice(5);

                const text = base64toAscii(jointQuorumData);

                expect(text).to.include('{"msg":{"peers":{"new":');
                expect(text).to.include(NEW_PEER);
            });

            it('should append single quorum to log', async () => {

                await waitUntil(() => logFileName = fileExists());

                await waitUntil(() => includes(readFile('output/', logFileName), 'Appending single_quorum to my log'));
            });

            it('should persist single quorum to .dat', async () => {

                await waitUntil(() => {
                    return readFile('output/.state/', DAEMON_UUIDS[0] + '.dat').split('\n').length > 3
                });

                const singleQuorumData = readFile('output/.state/', DAEMON_UUIDS[0] + '.dat').split('\n')[2].slice(5);

                const text = base64toAscii(singleQuorumData);

                expect(text).to.include('{"msg":{"peers":[{');
                expect(text).to.include(NEW_PEER);
            });
        });

        context('new node', () => {

            beforeEach('starting new node', () => {
                editConfigFile('bluzelle2.json', 5, '\n  "listener_port" : 50003');
                editConfigFile('bluzelle2.json', 1, '\n  "uuid" : "7a55cc24-e4e3-4d88-86a6-3a501e09ee26"');

                exec('cd ./scripts; ./run-daemon.sh bluzelle2.json');
            });

            afterEach(() => {
                resetConfigFile('bluzelle2.json');
            });

            it('should be able to sync', done => {
                const node = spawn('./run-daemon.sh', ['bluzelle2.json'], {cwd: './scripts'});

                node.stdout.on('data', data => {

                    let daemonData = {};

                    if (data.toString().includes('Create successful.')) {

                        DAEMON_UUIDS.forEach(v => {
                            daemonData[v] = readFile('/output/.state/', v + '.dat');
                        });

                        checkFilesConsistency(done, daemonData);
                    }
                });
            });
        });

        context('new swarm should be operational', () => {

            beforeEach(() =>
                api.connect(`ws://${process.env.address}:${process.env.port}`, '71e2cd35-b606-41e6-bb08-f20de30df76c'));

            it('should be able create', async () => {

                await api.create('key', 123);
            });

            it('should be able to read', async () => {

                await api.create('key', 'abc');

                await api.read('key');
            });
        });
    });

    context('removing peer', () => {

        beforeEach('start swarm', async () => {

            await startSwarm();

            exec('cd ./scripts; ./run-daemon.sh bluzelle2.json');
        });

        beforeEach('open ws connection', done => {

            socket = new WebSocket('ws://127.0.0.1:50000');
            socket.on('open', () => {
                socket.send(`{"bzn-api":"raft","cmd":"remove_peer","data":{"uuid":"3726ec5f-72b4-4ce6-9e60-f5c47f619a41"}}`);
                done();
            });
        });

        afterEach(async () => {
            await killSwarm();
        });

        context('swarm', () => {

            it('should append joint quorum to log', async () => {

                await waitUntil(() => logFileName = fileExists());

                await waitUntil(() => includes(readFile('output/', logFileName), 'Appending joint_quorum to my log'));
            });

            it('should persist joint quorum to .dat', async () => {

                await waitUntil(() => {
                    return readFile('output/.state/', DAEMON_UUIDS[0] + '.dat').split('\n').length > 2
                });

                const jointQuorumData = readFile('output/.state/', DAEMON_UUIDS[0] + '.dat').split('\n')[1].slice(5);

                const text = base64toAscii(jointQuorumData);

                expect(text).to.include('{"msg":{"peers":{"new":');
                expect(text).to.include('{"host":"127.0.0.1","http_port":8082,"name":"peer3","port":50002,"uuid":"3726ec5f-72b4-4ce6-9e60-f5c47f619a41"}')
            });

            it('should append single quorum to log', async () => {

                await waitUntil(() => logFileName = fileExists());

                await waitUntil(() => includes(readFile('output/', logFileName), 'Appending single_quorum to my log'));
            });

            it('should persist single quorum to .dat', async () => {

                await waitUntil(() => {
                    return readFile('output/.state/', DAEMON_UUIDS[0] + '.dat').split('\n').length > 3
                });

                const singleQuorumData = readFile('output/.state/', DAEMON_UUIDS[0] + '.dat').split('\n')[2].slice(5);

                const text = base64toAscii(singleQuorumData);

                expect(text).to.include('{"msg":{"peers":[{');
                expect(text).to.not.include('{"host":"127.0.0.1","http_port":8082,"name":"peer3","port":50002,"uuid":"3726ec5f-72b4-4ce6-9e60-f5c47f619a41"}');
            });

            context('with removed node still connected', () => {

                beforeEach(() =>
                    api.connect(`ws://${process.env.address}:${process.env.port}`, '71e2cd35-b606-41e6-bb08-f20de30df76c'));

                it('should be able create', async () => {

                    await api.create('key', 123);
                });

                it('should be able to read', async () => {

                    await api.create('key', 'abc');

                    await api.read('key');
                });
            });

            context('with removed node disconnected', () => {

                beforeEach(() => {

                    exec(`kill $(ps aux | grep 'bluzelle2' | awk '{print $2}')`);

                    api.connect(`ws://${process.env.address}:${process.env.port}`, '71e2cd35-b606-41e6-bb08-f20de30df76c');
                });

                it('should be able create', async () => {

                    await api.create('key', 123);
                });

                it('should be able to read', async () => {

                    await api.create('key', 'abc');

                    await api.read('key');
                });
            });
        });

    });
});

const base64toAscii = data =>
    new Buffer(data, 'base64').toString('ascii');
