const {spawn, exec, execSync} = require('child_process');
const WebSocket = require('ws');

const {BluzelleClient} = require('../bluzelle-js/lib/bluzelle-node');
const {spawnSwarm, despawnSwarm, spawnDaemon, deleteConfigs, clearDaemonState, createKeys, getCurrentLeader, pollStatus} = require('../utils/daemon/setup');
const {editFile, generateSwarmConfigsAndSetState, resetHarnessState, getSwarmObj, getNewestNodes, generateConfigs} = require('../utils/daemon/configs');
const shared = require('./shared');

let swarm, newPeerConfig;
let clientsObj = {};
let numOfNodes = 6;

describe('swarm membership', () => {

    context('adding', () => {

        context('peer with valid signature', () => {

            context('resulting swarm', () => {

                context('has sufficient nodes alive for consensus', () => {

                    beforeEach('generate configs and set harness state', async () => {
                        await generateSwarmConfigsAndSetState(numOfNodes);
                        swarm = getSwarmObj();

                        newPeerConfig = (await generateConfigs(1))[0];
                    });

                    beforeEach('edit new peer cfg', () => {

                        editFile(
                            {
                                filename: `bluzelle${newPeerConfig.index}.json`,
                                changes: {
                                    uuid: 'e81ca538-a222-4add-8cb8-065c8b65a391',
                                    bootstrap_file: './peers.json'
                                }
                            });
                    });

                    beforeEach('spawn swarm', async function () {
                        const MINIMUM_REQUIRED_FOR_CONSENSUS = numOfNodes / 2 + 1;
                        this.timeout(20000);
                        await spawnSwarm({consensusAlgo: 'raft', partialSpawn: MINIMUM_REQUIRED_FOR_CONSENSUS, failureAllowed: 0})
                    });

                    beforeEach('initialize client', () => {

                        clientsObj.api = new BluzelleClient(
                            `ws://${process.env.address}::${swarm[swarm.leader].port}`,
                            '71e2cd35-b606-41e6-bb08-f20de30df76c',
                            false
                        );
                    });

                    beforeEach('connect client', async () => {
                        await clientsObj.api.connect()
                    });

                    beforeEach('populate db', async () =>
                        await createKeys(clientsObj, 5, 500));

                    beforeEach('open ws connection to leader and send add peer msg', async () => {
                        const NEW_PEER = JSON.stringify(
                            {
                                host: "127.0.0.1",
                                http_port: newPeerConfig.content.http_port,
                                name: "new_peer",
                                port: newPeerConfig.content.listener_port,
                                uuid: "e81ca538-a222-4add-8cb8-065c8b65a391",
                                signature: "eVrqlFy0MacQuvCFkMJvynfp+hMUvfwJ4rY21bvZ+pyX9F04oo3ayknZAc1O1zlviWuFCZ9/J" +
                                "mA2z0sDHtJ84PZBuaSYvXwJXQsXq4Tvb7thcgnCdc6Pkg5VFq7rvRMV3kHo5TKoAIfVXAOc1SzFfnrVlimVx" +
                                "dpqJxMZeSQiEv+GqfZPNT3f+YgDx5GJ0yBOe8XDAA1Rg3CgYdWFEvLz3rH6KcDv/+5Ni7UayuV5BWoIASHI6" +
                                "0OhMOBpOffyvCvrFlHN1FA1a0N7IZfpbH6fHaVFs7/roC+NkV+6Rhx/kv6J/TnEWeOtUREcnInmW4WzI5Pu8" +
                                "dSaFLvuZj/DPOaEuKFNjGujJ7J0mbifUfvIZg66GqWCtKWfbSygqnP1f1ZqH+y43Etde6nPTl6y2gTiusbiG" +
                                "4s97nzfBhScujsHde294KraPdilEKgjTRXU+dxAaV8C0Fj64ZbhoYDoZ38aCG9xV5YsHElNLsqgWr7lRj/ru" +
                                "Fqi1T0UuQ7/ggCOhzAMSuKNfTUSqXYwUTwzu+mOWVb9UdsRrN4AZ7UgnTbyuI/tvyqk+kuooohh02QAGcOrM" +
                                "hjjKB6lSSJSzQbOGz/hqoeD1rMxHwErgTLe8nSmGPwf68KVzIX7i0z5e6eE+TPlTM4J8DsXqHZsVxIxZdiqE" +
                                "rx5hkBOrKzSfFQAdooYutM="
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

                    afterEach('disconnect api', () => clientsObj.api.disconnect());

                    afterEach('despawn swarm', despawnSwarm);

                    context('is operational', () => {

                        shared.swarmIsOperational(clientsObj);
                    });

                    context('new node', () => {

                        it('should be communicating with swarm', async () => {
                            await pollStatus({port: newPeerConfig.content.listener_port, expectConnected: true})
                        })
                    });
                });

            });
        });

        const msg = `"host":"127.0.0.1","http_port":${8080 + numOfNodes},"name":"new_peer","port":${50000 + numOfNodes},"uuid":`;
        const scenarios = {
            'blacklisted peer with valid signature': {
                uuid: '51bfd541-ab3e-4f02-93c7-8c3328daccfa',
                signature: 'yEQU8GZASNFYN5OEBnBfr/u0lLUnHpk4Qw0NlONKSocrFiBGx4hRdW4gZxl3p3Js' +
                'u8Ko1bppjl9GQzwZWBy8w3OMMCxYhlzOZtsE6TWayO5fD2BQ4Uww8ZymfPfIkwhg' +
                'vnv/Wa4nGC0COMVAq6XALra3W162tSTIW6ZcZ3DTykTtInruXgkRU8el6R1Yhgu4' +
                'pB4KK7YRijN8TBni0iJc4dRMTiDeDUuwrPfMj1qOFZEfw1YHZOZ1wsHCkp9MTDU/' +
                'O5iJsA8KDBDH5niVMqdo+cc3icLvRkGL1GQrpzGWYFc6UcXe9qjKUidiIGvPeSdE' +
                'uN8Dsq/DtWr5RFrgo+JL99jyXV4Vf3pDpVR0boOZT8DL9oha5mXbihWjFfBu21js' +
                '3T7q+YF2NyaxJEuCJi86ibKNcbzVvMiONBLsuZrn70he7/TZss0tyA4jcYLzX3jO' +
                'Hub5RRxia2aY/AeAYTNYNrULpmfTSBWhvtbHJJl/ztr8FJW58I91iJcf3NPFOdLO' +
                'cpdV25kn1PYsc+/keluFJTjLE9uRQLMvUrcbzakuKIXfQFsUirjuo+RFGLJtKPEn' +
                'AMmQrsJRiKbhmiCSUUXQUZreb9buo6UIIqnO6a03CBi6xZ14qXjSnHHnmkvBNOpR' +
                'Q7wm9gg93OAx3FHhUuX7t5+EYkF5miujg6ExzALEBB0=',
                get cmd() {
                    return `{${msg}"${this.uuid}","signature":"${this.signature}"}`
                }
            }
        };

        Object.keys(scenarios).forEach((test) => {

            // blacklisted node is successfully added to swarm: KEP-647
            context.skip(test, () => {

                beforeEach('generate configs and set harness state', async () => {
                    await generateSwarmConfigsAndSetState(numOfNodes);
                    swarm = getSwarmObj();
                    newPeerConfig = (await generateConfigs(1))[0]
                });

                beforeEach('edit new peer config', () => {

                    editFile(
                        {
                            filename: `bluzelle${newPeerConfig.index}.json`,
                            changes: {
                                uuid: scenarios[test].uuid,
                                bootstrap_file: './peers.json'
                            }
                        });
                });

                beforeEach('spawn swarm', async function () {
                    this.timeout(20000);
                    await spawnSwarm({consensusAlgo: 'raft'})
                });

                beforeEach('initialize client', () => {

                    clientsObj.api = new BluzelleClient(
                        `ws://${process.env.address}::${swarm[swarm.leader].port}`,
                        '71e2cd35-b606-41e6-bb08-f20de30df76c',
                        false
                    );
                });

                beforeEach('connect client', async () => {
                    await clientsObj.api.connect()
                });

                beforeEach('open ws connection to leader and send msg', async () =>
                    await connectWsAndSendMsg(swarm, `{"bzn-api":"raft","cmd":"add_peer","data":{"peer":${scenarios[test].cmd}}}`));

                beforeEach('spawn new peer', async () => await spawnDaemon(newPeerConfig.index));

                beforeEach('populate db', async () =>
                    await createKeys(clientsObj, 5, 500));

                afterEach('remove configs and peerslist and clear harness state', () => {
                    deleteConfigs();
                    resetHarnessState();
                });

                afterEach('disconnect api', () => clientsObj.api.disconnect());

                afterEach('despawn swarm', despawnSwarm);

                it('should not be able to communicate with swarm', async () => {
                    await pollStatus({port: newPeerConfig.content.listener_port, expectSingleton: true})
                })

            });
        });

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
                    await generateSwarmConfigsAndSetState(numOfNodes);
                    swarm = getSwarmObj();
                    newPeerConfig = (await generateConfigs(1))[0]
                });

                beforeEach('edit new peer config', () => {

                    editFile(
                        {
                            filename: `bluzelle${newPeerConfig.index}.json`,
                            changes: {
                                uuid: INVALID_ADD_PEERS_REQUESTS[test].uuid,
                                bootstrap_file: './peers.json'
                            }
                        });
                });

                beforeEach('spawn swarm', async function () {
                    this.timeout(20000);
                    await spawnSwarm({consensusAlgo: 'raft'})
                });

                afterEach('remove configs and peerslist and clear harness state', () => {
                    deleteConfigs();
                    resetHarnessState();
                });

                afterEach('despawn swarm', despawnSwarm);

                it('should not be able to communicate with swarm', async () => new Promise(async (res) => {

                    try {
                        await connectWsAndSendMsg(swarm, `{"bzn-api":"raft","cmd":"add_peer","data":{"peer":${INVALID_ADD_PEERS_REQUESTS[test].cmd}}}`)
                    } catch (err) {
                        if (err.message === INVALID_ADD_PEERS_REQUESTS[test].expect) {
                            res()
                        } else {
                            console.log(err.message)
                        }
                    }
                }))
            })
        })
    });

    context('removing peer', () => {

        context('resulting swarm', () => {

            context('has sufficient nodes alive for consensus', () => {

                beforeEach('generate configs and set harness state', async () => {
                    await generateSwarmConfigsAndSetState(numOfNodes);
                    swarm = getSwarmObj();
                    newPeerConfig = swarm[`daemon${numOfNodes - 1}`];
                });

                beforeEach('spawn swarm', async function () {
                    this.timeout(20000);
                    await spawnSwarm({consensusAlgo: 'raft', partialSpawn: numOfNodes - 1});
                });

                beforeEach('spawn new peer', async () => await spawnDaemon(newPeerConfig.index));

                beforeEach('initialize client and connect', async () => {

                    clientsObj.api = new BluzelleClient(
                        `ws://${process.env.address}:${process.env.address}:${swarm[swarm.leader].port}`,
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

                afterEach('disconnect api', () => clientsObj.api.disconnect());

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
                    await generateSwarmConfigsAndSetState(numOfNodes);
                    swarm = getSwarmObj();
                });

                beforeEach('spawn swarm', async function () {
                    const MINIMUM_REQUIRED_FOR_CONSENSUS = numOfNodes / 2 + 1;
                    this.timeout(20000);
                    await spawnSwarm({consensusAlgo: 'raft', partialSpawn: MINIMUM_REQUIRED_FOR_CONSENSUS, failureAllowed: 0})
                });

                beforeEach('initialize client and connect', async () => {

                    clientsObj.api = new BluzelleClient(
                        `ws://${process.env.address}:${process.env.address}:${swarm[swarm.leader].port}`,
                        '71e2cd35-b606-41e6-bb08-f20de30df76c',
                        false
                    );

                    await clientsObj.api.connect()
                });

                beforeEach('populate db', async () =>
                    await createKeys(clientsObj, 5, 500));

                beforeEach('open ws connection to leader and send msg', async () => {
                    const nodeAliveInSwarm = swarm.guaranteedNodes[0];

                    try {
                        await connectWsAndSendMsg(swarm, `{"bzn-api":"raft","cmd":"remove_peer","data":{"uuid":"${swarm[nodeAliveInSwarm].uuid}"}}`);
                    } catch (err) {
                        console.log(err)
                    }
                });

                afterEach('remove configs and peerslist and clear harness state', () => {
                    deleteConfigs();
                    resetHarnessState();
                });

                afterEach('disconnect api', () => clientsObj.api.disconnect());

                afterEach('despawn swarm', despawnSwarm);

                context('is NOT operational', () => {

                    shared.createShouldTimeout(clientsObj);
                });
            });
        });
    });
});

const connectWsAndSendMsg = (swarm, msg) => new Promise((resolve, reject) => {

        socket = new WebSocket(`ws://127.0.0.1:${swarm[swarm.leader].port}`);

        socket.on('open', () => {
            socket.send(msg);
        });

        socket.on('message', (response) => {
            let message = JSON.parse(response);

            if (message.error) {
                reject(new Error(message.error))
            } else {
                setTimeout(resolve, 500) // pause to give db time to achieve consensus and commit single quorum
            }
        });

        if (msg.includes('remove_peer')) {
            // No response from daemon on successful remove_peer. KEP-728
            setTimeout(resolve, 1000) // pause to give db time to achieve consensus and commit single quorum
        }
});
