const {spawn, exec} = require('child_process');
const WebSocket = require('ws');
const waitUntil = require("async-wait-until");
const {includes, filter} = require('lodash');
const expect = require('chai').expect;
const fs = require('fs');

const api = require('../bluzelle-js/src/api');
const {fileExists, readFile, readDir, checkFilesConsistency} = require('../utils/daemon/logs');
const {startSwarm, killSwarm} = require('../utils/daemon/setup');
const {editConfigFile, resetConfigFile} = require('../utils/daemon/configs');
const shared = require('./shared');

const DAEMON_UUIDS = ["60ba0788-9992-4cdb-b1f7-9f68eef52ab9", "c7044c76-135b-452d-858a-f789d82c7eb7"];


const jointQuorumTests = (nodeInfo) => {

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
        expect(text).to.include(nodeInfo)
    });
};

const singleQuorumTests = (nodeInfo, include) => {

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

        include ? expect(text).to.include(nodeInfo) : expect(text).to.not.include(nodeInfo)
    });
};


describe('swarm membership', () => {

    context('adding new peer', () => {

        const NEW_PEER = '{"host":"127.0.0.1","http_port":8083,"name":"new_peer","port":50003,"uuid":"7a55cc24-e4e3-4d88-86a6-3a501e09ee26"}';
        let logFileName;

        context('resulting swarm', () => {

            context('has sufficient nodes alive for consensus', () => {

                beforeEach('setting peerlist', () => {

                    const CONTENT = '[\n' +
                        '  {"name": "peer1", "host": "127.0.0.1", "port": 50000, "uuid" : "60ba0788-9992-4cdb-b1f7-9f68eef52ab9", "http_port": 8080},\n' +
                        '  {"name": "peer2", "host": "127.0.0.1",  "port": 50001, "uuid" : "c7044c76-135b-452d-858a-f789d82c7eb7", "http_port": 8081}\n' +
                        ']\n';

                    fs.writeFileSync(`./daemon-build/output/peers.json`, CONTENT, 'utf8');
                });

                beforeEach('start swarm', startSwarm);
                beforeEach('open ws connection', done => {
                    socket = new WebSocket('ws://127.0.0.1:50000');
                    socket.on('open', () => {
                        socket.send(`{"bzn-api":"raft","cmd":"add_peer","data":{"peer":${NEW_PEER}}}`);
                        done();
                    });
                });

                afterEach('kill swarm', killSwarm);

                jointQuorumTests(NEW_PEER);

                singleQuorumTests(NEW_PEER, true);

                context('is operational', () => {

                    beforeEach(() =>
                        api.connect(`ws://${process.env.address}:${process.env.port}`, '71e2cd35-b606-41e6-bb08-f20de30df76c'));

                    shared.swarmIsOperational();
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

                    // waiting for successful sync message KEP-377
                    it.skip('should be able to sync', done => {
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
            });

            context('has insufficient nodes alive for consensus', () => {

                beforeEach('start swarm', startSwarm);

                beforeEach('open ws connection and send msg', done => {
                    socket = new WebSocket('ws://127.0.0.1:50000');
                    socket.on('open', () => {
                        socket.send(`{"bzn-api":"raft","cmd":"add_peer","data":{"peer":${NEW_PEER}}}`);
                        done();
                    });
                });

                afterEach('kill swarm', killSwarm);

                jointQuorumTests(NEW_PEER);

                context('is NOT operational', () => {

                    beforeEach(() =>
                        api.connect(`ws://${process.env.address}:${process.env.port}`, '71e2cd35-b606-41e6-bb08-f20de30df76c'));

                    shared.createShouldTimeout();
                });
            });
        });
    });

    context('removing peer', () => {

        context('resulting swarm', () => {

            context('has sufficient nodes alive for consensus', () => {

                let daemonData = '';

                beforeEach('start swarm', async () => {

                    await startSwarm();

                    const node = spawn('./run-daemon.sh', ['bluzelle2.json'], {cwd: './scripts'});

                    node.stdout.on('data', data => {
                        daemonData += data.toString();
                    });
                });

                beforeEach('open ws connection', done => {

                    socket = new WebSocket('ws://127.0.0.1:50000');
                    socket.on('open', () => {
                        socket.send(`{"bzn-api":"raft","cmd":"remove_peer","data":{"uuid":"3726ec5f-72b4-4ce6-9e60-f5c47f619a41"}}`);
                        done();
                    });
                });

                afterEach('kill swarm', killSwarm);

                jointQuorumTests('{"host":"127.0.0.1","http_port":8082,"name":"peer3","port":50002,"uuid":"3726ec5f-72b4-4ce6-9e60-f5c47f619a41"}');

                singleQuorumTests('{"host":"127.0.0.1","http_port":8082,"name":"peer3","port":50002,"uuid":"3726ec5f-72b4-4ce6-9e60-f5c47f619a41"}');

                context('removed node', () => {

                    context('becomes a singleton swarm', () => {

                        it('should remain in candidate state', async function() {
                            this.timeout(12000);

                            await waitUntil(() =>
                                ((daemonData.match(/RAFT State: Candidate/g) || []).length >= 2 ), 12000)
                        });
                    });

                    context('still online', () => {

                        beforeEach(() =>
                            api.connect(`ws://${process.env.address}:${process.env.port}`, '71e2cd35-b606-41e6-bb08-f20de30df76c'));

                        shared.swarmIsOperational();

                    });

                    context('offline', () => {

                        beforeEach(() => {

                            exec(`kill $(ps aux | grep 'bluzelle2' | awk '{print $2}')`);

                            api.connect(`ws://${process.env.address}:${process.env.port}`, '71e2cd35-b606-41e6-bb08-f20de30df76c');
                        });

                        shared.swarmIsOperational();

                    });
                });
            });

            context('has insufficient nodes alive for consensus', () => {

                beforeEach('setting peerlist', () => {

                    const CONTENT = '[\n' +
                        '  {"name": "peer1", "host": "127.0.0.1", "port": 50000, "uuid" : "60ba0788-9992-4cdb-b1f7-9f68eef52ab9", "http_port": 8080},\n' +
                        '  {"name": "peer2", "host": "127.0.0.1",  "port": 50001, "uuid" : "c7044c76-135b-452d-858a-f789d82c7eb7", "http_port": 8081}\n' +
                        ']\n';

                    fs.writeFileSync(`./daemon-build/output/peers.json`, CONTENT, 'utf8');
                });

                beforeEach('start swarm', async () => {
                    await startSwarm();
                });

                beforeEach('open ws connection and send msg', done => {

                    socket = new WebSocket('ws://127.0.0.1:50000');
                    socket.on('open', () => {
                        socket.send(`{"bzn-api":"raft","cmd":"remove_peer","data":{"uuid":"c7044c76-135b-452d-858a-f789d82c7eb7"}}`);
                        done()
                    });
                });

                afterEach('kill swarm', killSwarm);

                jointQuorumTests('{"host":"127.0.0.1","http_port":8081,"name":"peer2","port":50001,"uuid":"c7044c76-135b-452d-858a-f789d82c7eb7"}');

                singleQuorumTests('{"host":"127.0.0.1","http_port":8081,"name":"peer2","port":50001,"uuid":"c7044c76-135b-452d-858a-f789d82c7eb7"}');

                context('is NOT operational', () => {

                    beforeEach(() =>
                        api.connect(`ws://${process.env.address}:${process.env.port}`, '71e2cd35-b606-41e6-bb08-f20de30df76c'));

                    shared.createShouldTimeout();
                });
            });
        });
    });
});

const base64toAscii = data =>
    new Buffer(data, 'base64').toString('ascii');
