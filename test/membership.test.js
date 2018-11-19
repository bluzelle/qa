const {spawn, exec, execSync} = require('child_process');
const WebSocket = require('ws');

const {BluzelleClient} = require('../bluzelle-js/lib/bluzelle-node');
const {spawnSwarm, despawnSwarm, spawnDaemon, deleteConfigs, createKeys, pollStatus} = require('../utils/daemon/setup');
const {editFile, generateSwarmJsonsAndSetState, resetHarnessState, generateConfigs} = require('../utils/daemon/configs');
const shared = require('./shared');
const SwarmState = require('../utils/daemon/swarm');
const uuids = require('../utils/daemon/uuids');

let swarm, newPeerConfig;
let clientsObj = {};
let numOfNodes = harnessConfigs.numOfNodes;

describe('swarm membership', () => {
    // add_peer is intermittently failing: KEP-765 https://bluzelle.atlassian.net/browse/KEP-765
    // changing hooks with add_peer to 30000 timeout allows them to potentially pass
    context('adding', () => {

        context('peer with valid signature', () => {

            context('can auto add to swarm', () => {

                beforeEach('generate configs and set harness state', async () => {
                    let [configsObject] = await generateSwarmJsonsAndSetState(numOfNodes);
                    swarm = new SwarmState(configsObject);

                    newPeerConfig = (await generateConfigs({numOfConfigs: 1}))[0];
                });

                beforeEach('spawn swarm', async function () {
                    this.timeout(20000);
                    await spawnSwarm(swarm, {consensusAlgorithm: 'raft'})
                });

                beforeEach('initialize client', () => {

                    clientsObj.api = new BluzelleClient(
                        `ws://${harnessConfigs.address}:${swarm[swarm.leader].port}`,
                        '71e2cd35-b606-41e6-bb08-f20de30df76c',
                        false
                    );
                });

                beforeEach('connect client', async () => {
                    await clientsObj.api.connect()
                });

                beforeEach('populate db', async () =>
                    await createKeys(clientsObj, 5, 500));

                beforeEach('edit config files for new peer', () => {
                    // new peer can only auto add if it contains itself in its peerlist
                    try {
                        execSync('cd ./daemon-build/output/; cp peers.json peersWithNewPeer.json')
                    } catch (err) {
                        throw new Error('Error copying peers list');
                        throw err;
                    }

                    editFile(
                        {filename: 'peersWithNewPeer.json', push:
                                {
                                    name: "new_peer",
                                    host: "127.0.0.1",
                                    port: newPeerConfig.content.listener_port,
                                    uuid: newPeerConfig.content.uuid,
                                    http_port: newPeerConfig.content.http_port
                                }
                        });

                    editFile({filename: `bluzelle${newPeerConfig.index}.json`, changes: {bootstrap_file: "./peersWithNewPeer.json",}})
                });

                afterEach('remove configs and peerslist and clear harness state', () => {
                    deleteConfigs();
                    resetHarnessState();
                });

                afterEach('disconnect api', () => clientsObj.api && clientsObj.api.disconnect());

                afterEach('despawn swarm', despawnSwarm);

                it('should send add_peers automatically', async () => {
                    let node = spawn('script', ['-q', '/dev/null', './run-daemon.sh', `bluzelle${newPeerConfig.index}.json`], {cwd: './scripts'});

                    await new Promise(resolve => {
                        node.stdout.on('data', data => {
                            if (data.toString().includes('RAFT sending add_peer command to the leader:')) {
                                resolve();
                            }
                        });
                    });
                });

                it.skip('should be communicating with swarm', async function () {
                    this.timeout(30000);

                    await spawnDaemon(newPeerConfig.index);
                    await pollStatus({port: newPeerConfig.content.listener_port, expectConnected: true})
                })

            });

            context('resulting swarm', () => {

                context('has sufficient nodes alive for consensus', () => {

                    beforeEach('generate configs and set harness state', async () => {
                        let [configsObject] = await generateSwarmJsonsAndSetState(numOfNodes);
                        swarm = new SwarmState(configsObject);

                        newPeerConfig = (await generateConfigs({numOfConfigs: 1}))[0];
                    });

                    beforeEach('spawn swarm', async function () {
                        const MINIMUM_REQUIRED_FOR_CONSENSUS = Math.floor(numOfNodes / 2) + 1;
                        this.timeout(20000);
                        await spawnSwarm(swarm, {consensusAlgorithm: 'raft', partialSpawn: MINIMUM_REQUIRED_FOR_CONSENSUS, failureAllowed: 0})
                    });

                    beforeEach('initialize client', () => {

                        clientsObj.api = new BluzelleClient(
                            `ws://${harnessConfigs.address}:${swarm[swarm.leader].port}`,
                            '71e2cd35-b606-41e6-bb08-f20de30df76c',
                            false
                        );
                    });

                    beforeEach('connect client', async () => {
                        await clientsObj.api.connect()
                    });

                    beforeEach('populate db', async () =>
                        await createKeys(clientsObj, 5, 500));

                    beforeEach('open ws connection to leader and send add peer msg', async function () {
                        this.timeout(30000);

                        const NEW_PEER = JSON.stringify(
                            {
                                host: "127.0.0.1",
                                http_port: newPeerConfig.content.http_port,
                                name: "new_peer",
                                port: newPeerConfig.content.listener_port,
                                uuid: newPeerConfig.content.uuid,
                                signature: newPeerConfig.content.signed_key
                            });

                        try {
                            await connectWsAndSendMsg(swarm, `{"bzn-api":"raft","cmd":"add_peer","data":{"peer":${NEW_PEER}}}`);
                        } catch (err) {
                            console.log(err)
                        }
                    });

                    beforeEach('spawn new peer', async () => await spawnDaemon(newPeerConfig.index));

                    afterEach('remove configs and peerslist and clear harness state', () => {
                        deleteConfigs();
                        resetHarnessState();
                    });

                    afterEach('disconnect api', () => clientsObj.api && clientsObj.api.disconnect());

                    afterEach('despawn swarm', despawnSwarm);

                    context.skip('is operational', () => {

                        shared.swarmIsOperational(clientsObj);
                    });

                    context('new node', () => {

                        it.skip('should be communicating with swarm', async () => {
                            await pollStatus({port: newPeerConfig.content.listener_port, expectConnected: true})
                        })
                    });
                });
            });
        });

        context('blacklisted peer with valid signature', () => {

            beforeEach('generate configs and set harness state', async () => {
                let [configsObject] = await generateSwarmJsonsAndSetState(numOfNodes);
                swarm = new SwarmState(configsObject);

                const blackistedUuid = uuids.blacklist()[0];
                newPeerConfig = (await generateConfigs({uuidArray: [blackistedUuid]}))[0];
            });

            beforeEach('spawn swarm', async function () {
                this.timeout(20000);
                await spawnSwarm(swarm, {consensusAlgorithm: 'raft'})
            });

            beforeEach('initialize client', () => {

                clientsObj.api = new BluzelleClient(
                    `ws://${harnessConfigs.address}:${swarm[swarm.leader].port}`,
                    '71e2cd35-b606-41e6-bb08-f20de30df76c',
                    false
                );
            });

            beforeEach('connect client', async () => {
                await clientsObj.api.connect()
            });

            beforeEach('populate db', async () =>
                await createKeys(clientsObj, 5, 500));

            beforeEach('open ws connection to leader and send add peer msg', async function () {
                this.timeout(30000);

                const NEW_PEER = JSON.stringify(
                    {
                        host: "127.0.0.1",
                        http_port: newPeerConfig.content.http_port,
                        name: "new_peer",
                        port: newPeerConfig.content.listener_port,
                        uuid: newPeerConfig.content.uuid,
                        signature: newPeerConfig.content.signed_key
                    });

                try {
                    await connectWsAndSendMsg(swarm, `{"bzn-api":"raft","cmd":"add_peer","data":{"peer":${NEW_PEER}}}`);
                } catch (err) {
                    console.log(err)
                }
            });

            afterEach('remove configs and peerslist and clear harness state', () => {
                deleteConfigs();
                resetHarnessState();
            });

            afterEach('disconnect api', () => clientsObj.api && clientsObj.api.disconnect());

            afterEach('despawn swarm', despawnSwarm);

            it('should log disallowed message', async () => {

                let node = spawn('script', ['-q', '/dev/null', './run-daemon.sh', `bluzelle${newPeerConfig.index}.json`], {cwd: './scripts'});

                await new Promise(resolve => {
                    node.stdout.on('data', data => {
                        if (data.toString().includes('This node has been actively disallowed from the Bluzelle network. Please contact support@bluzelle.com.')) {
                            resolve();
                        }
                    });
                });
            });

            it('should exit', async () => {

                let node = spawn('script', ['-q', '/dev/null', './run-daemon.sh', `bluzelle${newPeerConfig.index}.json`], {cwd: './scripts'});

                await new Promise(resolve => {
                    node.on('close', code => {
                        resolve()
                    });
                });
            })

        });

        context('peer with invalid signature', () => {

            context('will attempt auto add to swarm', () => {

                beforeEach('generate configs and set harness state', async () => {
                    let [configsObject] = await generateSwarmJsonsAndSetState(numOfNodes);
                    swarm = new SwarmState(configsObject);

                    const blackistedUuid = uuids.blacklist()[0];
                    newPeerConfig = (await generateConfigs({uuidArray: [blackistedUuid]}))[0];
                });

                beforeEach('spawn swarm', async function () {
                    this.timeout(20000);
                    await spawnSwarm(swarm, {consensusAlgorithm: 'raft'})
                });

                beforeEach('initialize client', () => {

                    clientsObj.api = new BluzelleClient(
                        `ws://${harnessConfigs.address}:${swarm[swarm.leader].port}`,
                        '71e2cd35-b606-41e6-bb08-f20de30df76c',
                        false
                    );
                });

                beforeEach('connect client', async () => {
                    await clientsObj.api.connect()
                });

                beforeEach('populate db', async () =>
                    await createKeys(clientsObj, 5, 500));

                beforeEach('edit config files for new peer', () => {
                    // new peer can only auto add if it contains itself in its peerlist
                    try {
                        execSync('cd ./daemon-build/output/; cp peers.json peersWithNewPeer.json')

                    } catch (err) {
                        throw new Error('Error copying peers list');
                        throw err;
                    }

                    editFile(
                        {filename: 'peersWithNewPeer.json', push:
                                {
                                    name: "new_peer",
                                    host: "127.0.0.1",
                                    port: newPeerConfig.content.listener_port,
                                    uuid: newPeerConfig.content.uuid,
                                    http_port: newPeerConfig.content.http_port
                                }
                        });

                    editFile({filename: `bluzelle${newPeerConfig.index}.json`, changes: {bootstrap_file: "./peersWithNewPeer.json",}})
                });

                afterEach('remove configs and peerslist and clear harness state', () => {
                    deleteConfigs();
                    resetHarnessState();
                });

                afterEach('disconnect api', () => clientsObj.api && clientsObj.api.disconnect());

                afterEach('despawn swarm', despawnSwarm);

                it('should log disallowed message', async () => {

                    let node = spawn('script', ['-q', '/dev/null', './run-daemon.sh', `bluzelle${newPeerConfig.index}.json`], {cwd: './scripts'});

                    await new Promise(resolve => {
                        node.stdout.on('data', data => {
                            if (data.toString().includes('This node has been actively disallowed from the Bluzelle network. Please contact support@bluzelle.com.')) {
                                resolve();
                            }
                        });
                    });
                });

            });

            const msg = `"host":"127.0.0.1","http_port":${8080 + numOfNodes},"name":"new_peer","port":${50000 + numOfNodes},"uuid":`;

            const INVALID_ADD_PEERS_REQUESTS = {
                'peer with no signature': {
                    uuid: '854e8e35-b5e6-46bb-93bb-33f266068be7',
                    expect: 'ERROR_INVALID_SIGNATURE',
                    get cmd() {
                        return `{${msg}"${this.uuid}"}`
                    }
                },
                'peer with invalid signature': {
                    uuid: '7940d49c-9fac-4a46-b69f-6497fc411532',
                    signature: 'somesignature',
                    expect: 'ERROR_UNABLE_TO_VALIDATE_UUID',
                    get cmd() {
                        return `{${msg}"${this.uuid}","signature":"${this.signature}"}`
                    }
                },
                'blacklisted peer with invalid signature': {
                    uuid: 'f06ab617-7ccc-45fe-aee2-d4f5d175891b',
                    signature: 'somesignature',
                    expect: 'ERROR_UNABLE_TO_VALIDATE_UUID',
                    get cmd() {
                        return `{${msg}"${this.uuid}","signature":"${this.signature}"}`
                    }
                }
            };

            Object.keys(INVALID_ADD_PEERS_REQUESTS).forEach((test) => {

                context(test, () => {

                    beforeEach('generate configs and set harness state', async () => {
                        let [configsObject] = await generateSwarmJsonsAndSetState(numOfNodes);
                        swarm = new SwarmState(configsObject);
                        newPeerConfig = (await generateConfigs({numOfConfigs: 1}))[0]
                    });

                    beforeEach('edit new peer config', () => {

                        editFile(
                            {
                                filename: `bluzelle${newPeerConfig.index}.json`,
                                changes: {
                                    uuid: INVALID_ADD_PEERS_REQUESTS[test].uuid,
                                    bootstrap_file: './peers.json',
                                    signature: INVALID_ADD_PEERS_REQUESTS[test].signature
                                }
                            });
                    });

                    beforeEach('spawn swarm', async function () {
                        this.timeout(20000);
                        await spawnSwarm(swarm, {consensusAlgorithm: 'raft'})
                    });

                    afterEach('remove configs and peerslist and clear harness state', () => {
                        deleteConfigs();
                        resetHarnessState();
                    });

                    afterEach('despawn swarm', despawnSwarm);

                    it(`should receive ${INVALID_ADD_PEERS_REQUESTS[test].expect} from add_peer response`, async function () {
                        this.timeout(30000);

                        return new Promise(async (res) => {

                            try {
                                await connectWsAndSendMsg(swarm, `{"bzn-api":"raft","cmd":"add_peer","data":{"peer":${INVALID_ADD_PEERS_REQUESTS[test].cmd}}}`)
                            } catch (err) {
                                if (err.message === INVALID_ADD_PEERS_REQUESTS[test].expect) {
                                    res()
                                } else {
                                    console.log(err.message)
                                }
                            }
                        })
                    })
                })
            })
        });

    });

    context('removing peer', () => {

        context('resulting swarm', () => {

            context('has sufficient nodes alive for consensus', () => {

                beforeEach('generate configs and set harness state', async () => {
                    let [configsObject] = await generateSwarmJsonsAndSetState(numOfNodes);
                    swarm = new SwarmState(configsObject);
                    newPeerConfig = swarm[`daemon${numOfNodes - 1}`];
                });

                beforeEach('spawn swarm', async function () {
                    this.timeout(20000);
                    await spawnSwarm(swarm, {consensusAlgorithm: 'raft', partialSpawn: numOfNodes - 1});
                });

                beforeEach('spawn new peer', async () => await spawnDaemon(newPeerConfig.index));

                beforeEach('initialize client and connect', async () => {

                    clientsObj.api = new BluzelleClient(
                        `ws://${harnessConfigs.address}:${swarm[swarm.leader].port}`,
                        '71e2cd35-b606-41e6-bb08-f20de30df76c',
                        false
                    );

                    await clientsObj.api.connect()
                });

                beforeEach('populate db', async () =>
                    await createKeys(clientsObj, 5, 500));

                beforeEach('open ws connection to leader and send msg', async () => {
                    try {
                        await connectWsAndSendMsg(swarm, `{"bzn-api":"raft","cmd":"remove_peer","data":{"uuid":"${newPeerConfig.uuid}"}}`);
                    } catch (err) {
                        console.log(err)
                    }
                });

                afterEach('remove configs and peerslist and clear harness state', () => {
                    deleteConfigs();
                    resetHarnessState();
                });

                afterEach('disconnect api', () => clientsObj.api && clientsObj.api.disconnect());

                afterEach('despawn swarm', despawnSwarm);

                context('removed node', () => {

                    context('becomes a singleton swarm', () => {

                        it('should remain in candidate state', async () => {
                            await pollStatus({port: newPeerConfig.port, expectSingleton: true})
                        });
                    });

                    context('still online', () => {

                        shared.swarmIsOperational(clientsObj);
                    });

                    context('offline', () => {

                        beforeEach('kill removed peer', () =>
                            exec(`kill $(ps aux | grep 'bluzelle${newPeerConfig.index}' | awk '{print $2}')`));

                        shared.swarmIsOperational(clientsObj);
                    });
                });
            });

            context('has insufficient nodes alive for consensus', () => {

                beforeEach('generate configs and set harness state', async () => {
                    // override numOfNodes so that resulting swarm is guaranteed to result in swarm without consensus
                    numOfNodes = 9;
                    let [configsObject] = await generateSwarmJsonsAndSetState(numOfNodes);
                    swarm = new SwarmState(configsObject);
                });

                beforeEach('spawn swarm', async function () {
                    const MINIMUM_REQUIRED_FOR_CONSENSUS = Math.floor(numOfNodes / 2) + 1;
                    this.timeout(20000);
                    await spawnSwarm(swarm, {consensusAlgorithm: 'raft', partialSpawn: MINIMUM_REQUIRED_FOR_CONSENSUS, failureAllowed: 0})
                });

                beforeEach('initialize client and connect', async () => {

                    clientsObj.api = new BluzelleClient(
                        `ws://${harnessConfigs.address}:${swarm[swarm.leader].port}`,
                        '71e2cd35-b606-41e6-bb08-f20de30df76c',
                        false
                    );

                    await clientsObj.api.connect()
                });

                beforeEach('populate db', async () =>
                    await createKeys(clientsObj, 5, 500));

                beforeEach('open ws connection to leader and send msg', async () => {

                    const randomFollower = swarm.followers[0];

                    try {
                        await connectWsAndSendMsg(swarm, `{"bzn-api":"raft","cmd":"remove_peer","data":{"uuid":"${swarm[randomFollower].uuid}"}}`);
                    } catch (err) {
                        console.log(err)
                    }
                });

                afterEach('remove configs and peerslist and clear harness state', () => {
                    deleteConfigs();
                    resetHarnessState();
                });

                afterEach('disconnect api', () => clientsObj.api && clientsObj.api.disconnect());

                afterEach('despawn swarm', despawnSwarm);

                context('is NOT operational', () => {

                    shared.createShouldTimeout(clientsObj);
                });
            });
        });
    });
});

const connectWsAndSendMsg = (swarm, msg, {debug} = {}) => new Promise((resolve, reject) => {

        try {
            socket = new WebSocket(`ws://127.0.0.1:${swarm[swarm.leader].port}`);
        } catch (err) {
            rej(new Error('Failed to connect to leader'))
        }

        socket.on('open', () => {

            if (debug) {
                console.log('************************* MSG TO DAEMON ************************* ');
                console.log(msg);
                console.log('************************* MSG TO DAEMON ************************* ');
            };

            socket.send(msg);
        });

        socket.on('message', (response) => {
            let message = JSON.parse(response);

            if (debug) {
                console.log('********************* RESPONSE FROM DAEMON ********************* ');
                console.log(message);
                console.log('********************* RESPONSE FROM DAEMON ********************* ');
            };

            if (message.error) {
                reject(new Error(message.error))
            } else {
                setTimeout(resolve, 500) // pause to give db time to achieve consensus and commit single quorum
            }
        });

});
