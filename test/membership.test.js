const {spawn, exec, execSync} = require('child_process');
const WebSocket = require('ws');
const waitUntil = require("async-wait-until");
const {includes, filter} = require('lodash');
const {expect} = require('chai');

const api = require('../bluzelle-js/lib/bluzelle.node');
const {readFile, readDir, compareData} = require('../utils/daemon/logs');
const {startSwarm, killSwarm, swarm, createKeys} = require('../utils/daemon/setup');
const {editFile} = require('../utils/daemon/configs');
const shared = require('./shared');


const jointQuorumTests = (nodeInfo) => {

    it('should log joint quorum', async () => {

        try {
            await waitUntil(() => includes(readFile('output/logs/', swarm.logs[0]), 'Appending joint_quorum to my log'));
        } catch (error) {
            throw new Error(`Joint quorum not logged to log file.`)
        }

    });

    it('should persist joint quorum to .dat', async () => {

        const DAEMON_STORAGE_LOG_NAMES = readDir('output/.state').filter(file => file.endsWith('.dat'));

        // joint quorum is recorded as 2nd entry
        try {
            await waitUntil(() => readFile('output/.state/', DAEMON_STORAGE_LOG_NAMES[0]).split('\n').length > 2)
        } catch (error) {
            throw new Error(`Joint quorum not logged to .dat file`)
        }

        const jointQuorumData = readFile('output/.state/', DAEMON_STORAGE_LOG_NAMES[0]).split('\n')[1].slice(5);

        const text = base64toAscii(jointQuorumData);

        expect(text).to.include('{"msg":{"peers":{"new":');
        expect(text).to.include(nodeInfo)
    });
};

const singleQuorumTests = (nodeInfo, include) => {

    it('should log single quorum', async () => {

        try {
            await waitUntil(() => includes(readFile('output/logs/', swarm.logs[0]), 'Appending single_quorum to my log'));
        } catch (error) {
            throw new Error(`Single quorum not logged to log file`)
        }
    });

    it('should persist single quorum to .dat', async () => {

        const DAEMON_STORAGE_LOG_NAMES = readDir('output/.state').filter(file => file.endsWith('.dat'));

        // single quorum is recorded as 3rd entry
        try {
            await waitUntil(() => readFile('output/.state/', DAEMON_STORAGE_LOG_NAMES[0]).split('\n').length > 3);
        } catch (error) {
            throw new Error(`Single quorum not logged to .dat file`)
        }

        const singleQuorumData = readFile('output/.state/', DAEMON_STORAGE_LOG_NAMES[0]).split('\n')[2].slice(5);

        const text = base64toAscii(singleQuorumData);

        expect(text).to.include('{"msg":{"peers":[{');

        include ? expect(text).to.include(nodeInfo) : expect(text).to.not.include(nodeInfo)
    });
};


describe('swarm membership', () => {

    context('adding new peer', () => {

        const NEW_PEER = '{"host":"127.0.0.1","http_port":8083,"name":"new_peer","port":50003,"uuid":"7a55cc24-e4e3-4d88-86a6-3a501e09ee26"}';

        context('resulting swarm', () => {

            context('has sufficient nodes alive for consensus', () => {

                beforeEach('remove peer from peerlist', () =>
                    editFile({filename: 'peers.json', remove: {index: 2}}));

                beforeEach('start swarm', startSwarm);

                beforeEach('initialize client api', () => {
                    api.connect(`ws://${process.env.address}:${process.env.port}`, '71e2cd35-b606-41e6-bb08-f20de30df76c');
                });

                beforeEach('populate db', done => {
                    createKeys(done, api, process.env.numOfKeys);
                });

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

                    beforeEach(() => {

                        execSync('cp -R ./configs/peers.json ./daemon-build/output/peers2.json');

                        editFile(
                            {
                                filename: 'peers2.json',
                                changes: {
                                    index: 2,
                                    uuid: '7a55cc24-e4e3-4d88-86a6-3a501e09ee26',
                                    port: 50003,
                                    http_port: 8083
                                }
                            });

                        editFile(
                            {
                                filename: 'bluzelle2.json',
                                changes: {
                                    listener_port: 50003,
                                    uuid: '7a55cc24-e4e3-4d88-86a6-3a501e09ee26',
                                    bootstrap_file: './peers2.json'
                                }
                            });

                    });

                    it('should be able to sync', done => {

                        const node = spawn('./run-daemon.sh', ['bluzelle2.json'], {cwd: './scripts'});

                        let daemonData = {};

                        node.stdout.on('data', data => {

                            if (data.toString().includes('current term out of sync:')) {

                                const DAEMON_STORAGE_LOG_NAMES = readDir('output/.state').filter(file => file.endsWith('.dat'));

                                // waiting on finished sync message KEP-377, setTimeout for now
                                setTimeout(() => {
                                    DAEMON_STORAGE_LOG_NAMES.forEach(filename => {
                                        daemonData[filename] = readFile('output/.state/', filename);
                                    });
                                }, 100);

                                compareData(done, daemonData, true);
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

                    const node = spawn('script', ['-q' ,'/dev/null', './run-daemon.sh', 'bluzelle2.json'], {cwd: './scripts'});

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

                        it('should remain in candidate state', async () => {

                            await waitUntil(() =>
                                ((daemonData.match(/RAFT State: Candidate/g) || []).length >= 2), 4000)
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

                beforeEach('remove peer from peerlist', () =>
                    editFile({filename: 'peers.json', remove: {index: 2}}));

                beforeEach('start swarm', startSwarm);

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
    new Buffer.from(data, 'base64').toString('ascii');
