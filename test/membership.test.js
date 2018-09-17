const {spawn, exec, execSync} = require('child_process');
const WebSocket = require('ws');
const waitUntil = require("async-wait-until");

const api = require('../bluzelle-js/lib/bluzelle.node');
const {startSwarm, killSwarm, createKeys} = require('../utils/daemon/setup');
const {editFile} = require('../utils/daemon/configs');
const shared = require('./shared');


before('initialize client api', () =>
    api.connect(`ws://${process.env.address}:${process.env.port}`, '71e2cd35-b606-41e6-bb08-f20de30df76c'));

describe.only('swarm membership', () => {

    context('adding', () => {

        context('signed peer', () => {

            const NEW_PEER = '{"host":"127.0.0.1","http_port":8083,"name":"new_peer","port":50003,"uuid":"81ca538-a222-4add-8cb8-065c8b65a391", "signature" : "Oo8ZlDQcMlZF4hqnhN/2Dz3FYarZHrGf+87i+JUSxBu2GKFk8SYcDrwjc0DuhUCxpRVQppMk5fjZtJ3r6I9066jcEpJPljU1SC1Thpy+AUEYx0r640SKRw KwmJMe6mRdSJ75rcYHu5+etajOWWjMs4vYQtcwfVF3oEd9/pZjea8x6PuhnM50+FPpnvgu57L8vHdeWjCqAiPyomQSLgIJPjvMJw4aHUUE3tHX1WOB8XDH dvuhi9gZODzZWbdI92JNhoLbwvjmhKTeTN+FbBtdJIjC0+V0sMFmGNJQ8WIkJscN0hzRkmdlU965lHe4hqlcMyEdTSnYSnC7NIHFfvJFBBYi9kcAVBwkYy ALQDv6iTGMSI11/ncwdTz4/GGPodaUPFxf/WVHUz6rBAtTKvn8Kg61F6cVhcFSCjiw2bWGpeWcWTL+CGbfYCvZNiAVyO7Qdmfj5hoLu7KG+nxBLF8uoUl6 t3BdKz9Dqg9Vf+QVtaVj/COD1nUykXXRVxfLo4dNBS+aVsmOFjppKaEvmeT5SwWOSVrKZwPuTilV9jCehFbFZF6MPyiW5mcp9t4D27hMoz/SiKjCqdN93Y dBO4FBF/cWD5WHmD7KaaJYmnztz3W+xS7b/qk2PcN+qpZEXsfrWie4prB1umESavYLC1pLhoEgc0jRUl1b9mHSY7E4puk="}';

            context('resulting swarm', () => {

                context('has sufficient nodes alive for consensus', () => {

                    let newPeer;

                    beforeEach(() => {

                        editFile(
                            {
                                filename: 'peers.json',
                                changes: {
                                    index: 2,
                                    uuid: '81ca538-a222-4add-8cb8-065c8b65a391',
                                    port: 50003,
                                    http_port: 8083
                                }
                            });

                        editFile(
                            {
                                filename: 'bluzelle2.json',
                                changes: {
                                    listener_port: 50003,
                                    uuid: '81ca538-a222-4add-8cb8-065c8b65a391',
                                    bootstrap_file: './peers.json'
                                }
                            });

                    });

                    beforeEach('start swarm', startSwarm);

                    beforeEach('open ws connection and send msg', done =>
                        openSocketAndSendMsg(done, `{"bzn-api":"raft","cmd":"add_peer","data":{"peer":${NEW_PEER}}}`));

                    beforeEach('spawn new peer', () => {
                        newPeer = spawn('script', ['-q', '/dev/null', './run-daemon.sh', 'bluzelle2.json'], {cwd: './scripts'});

                        newPeer.stdout.on('data', () => {});
                    });

                    beforeEach('populate db', done =>
                        createKeys(done, api, process.env.numOfKeys));

                    afterEach('kill swarm', killSwarm);

                    context('is operational', () => {

                        shared.swarmIsOperational(api);

                    });

                    context('new node', () => {

                        it('should be communicating with swarm', async () => {

                            return new Promise((res) => {
                                newPeer.stdout.on('data', data => {

                                    if (data.toString().includes('Received WS message:')) {
                                        res()
                                    }
                                });
                            })

                        })
                    });
                });

                context('has insufficient nodes alive for consensus', () => {

                    beforeEach('start swarm', startSwarm);

                    beforeEach('open ws connection and send msg', done =>
                        openSocketAndSendMsg(done, `{"bzn-api":"raft","cmd":"add_peer","data":{"peer":${NEW_PEER}}}`));

                    afterEach('kill swarm', killSwarm);

                    context('is NOT operational', () => {

                        shared.createShouldTimeout(api);
                    });
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

                    const node = spawn('script', ['-q', '/dev/null', './run-daemon.sh', 'bluzelle2.json'], {cwd: './scripts'});

                    node.stdout.on('data', data => {
                        daemonData += data.toString();
                    });
                });

                beforeEach('open ws connection and send msg', done =>
                    openSocketAndSendMsg(done, `{"bzn-api":"raft","cmd":"remove_peer","data":{"uuid":"3726ec5f-72b4-4ce6-9e60-f5c47f619a41"}}`));

                beforeEach('populate db', done =>
                    createKeys(done, api, process.env.numOfKeys));

                afterEach('kill swarm', killSwarm);

                context('removed node', () => {

                    context('becomes a singleton swarm', () => {

                        it('should remain in candidate state', async () => {

                            await waitUntil(() =>
                                ((daemonData.match(/RAFT State: Candidate/g) || []).length >= 2), 4000)
                        });
                    });

                    context('still online', () => {

                        shared.swarmIsOperational(api);

                    });

                    context('offline', () => {

                        beforeEach('kill removed peer', () =>
                            exec(`kill $(ps aux | grep 'bluzelle2' | awk '{print $2}')`));

                        shared.swarmIsOperational(api);

                    });
                });
            });

            context('has insufficient nodes alive for consensus', () => {

                beforeEach('remove peer from peerlist', () =>
                    editFile({filename: 'peers.json', remove: {index: 2}}));

                beforeEach('start swarm', startSwarm);

                beforeEach('open ws connection and send msg', done =>
                    openSocketAndSendMsg(done, `{"bzn-api":"raft","cmd":"remove_peer","data":{"uuid":"c7044c76-135b-452d-858a-f789d82c7eb7"}}`));

                afterEach('kill swarm', killSwarm);

                context('is NOT operational', () => {

                    shared.createShouldTimeout(api);
                });
            });
        });
    });
});

const openSocketAndSendMsg = (done, msg) => {

    socket = new WebSocket('ws://127.0.0.1:50000');

    socket.on('open', () => {

        socket.send(msg);

        setTimeout(done, 500) // pause to give db time to achieve consensus and commit single quorum

    });
};
