const {spawn, exec, execSync} = require('child_process');
const WebSocket = require('ws');
const waitUntil = require("async-wait-until");

const api = require('bluzelle');
const {startSwarm, killSwarm, createKeys} = require('../utils/daemon/setup');
const {editFile} = require('../utils/daemon/configs');
const shared = require('./shared');


before('initialize client api', () =>
    api.connect(`ws://${process.env.address}:${process.env.port}`, '71e2cd35-b606-41e6-bb08-f20de30df76c'));

describe.only('swarm membership', () => {

    context('adding', () => {

        context('peer with valid siganture', () => {

            const NEW_PEER = '{"host":"127.0.0.1","http_port":8083,"name":"new_peer","port":50003,"uuid":' +
                '"81ca538-a222-4add-8cb8-065c8b65a391", "signature" : "Oo8ZlDQcMlZF4hqnhN/2Dz3FYarZHrGf+87i+JUSxBu2GK' +
                'Fk8SYcDrwjc0DuhUCxpRVQppMk5fjZtJ3r6I9066jcEpJPljU1SC1Thpy+AUEYx0r640SKRw KwmJMe6mRdSJ75rcYHu5+etajOW' +
                'WjMs4vYQtcwfVF3oEd9/pZjea8x6PuhnM50+FPpnvgu57L8vHdeWjCqAiPyomQSLgIJPjvMJw4aHUUE3tHX1WOB8XDH dvuhi9gZ' +
                'ODzZWbdI92JNhoLbwvjmhKTeTN+FbBtdJIjC0+V0sMFmGNJQ8WIkJscN0hzRkmdlU965lHe4hqlcMyEdTSnYSnC7NIHFfvJFBBYi' +
                '9kcAVBwkYy ALQDv6iTGMSI11/ncwdTz4/GGPodaUPFxf/WVHUz6rBAtTKvn8Kg61F6cVhcFSCjiw2bWGpeWcWTL+CGbfYCvZNiA' +
                'VyO7Qdmfj5hoLu7KG+nxBLF8uoUl6 t3BdKz9Dqg9Vf+QVtaVj/COD1nUykXXRVxfLo4dNBS+aVsmOFjppKaEvmeT5SwWOSVrKZw' +
                'PuTilV9jCehFbFZF6MPyiW5mcp9t4D27hMoz/SiKjCqdN93Y dBO4FBF/cWD5WHmD7KaaJYmnztz3W+xS7b/qk2PcN+qpZEXsfrW' +
                'ie4prB1umESavYLC1pLhoEgc0jRUl1b9mHSY7E4puk="}';

            context('resulting swarm', () => {

                context('has sufficient nodes alive for consensus', () => {

                    let newPeer;

                    beforeEach(() => {

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

            });
        });

        const msg = '"host":"127.0.0.1","http_port":8083,"name":"new_peer","port":50003,"uuid":';
        const scenarios = {
            'peer with no signature': {
                uuid: 'asdf',
                get cmd() {
                    return `{${msg}"${this.uuid}"}`
                }
            },
            'peer with invalid signature': {
                uuid: 'asdf',
                signature: 'somesignature',
                get cmd() {
                    return `{${msg}"${this.uuid}","signature":"${this.signature}"}`
                }
            },
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
            },
            'blacklisted peer with invalid signature': {
                uuid: 'f06ab617-7ccc-45fe-aee2-d4f5d175891b',
                signature: 'somesignature',
                get cmd() {
                    return `{${msg}"${this.uuid}","signature":"${this.signature}"}`
                }
            }
        };

        Object.keys(scenarios).forEach((test) => {

            context(test, () => {

                let newPeer;

                beforeEach(() => {

                    editFile(
                        {
                            filename: 'bluzelle2.json',
                            changes: {
                                listener_port: 50003,
                                uuid: scenarios[test].uuid,
                                bootstrap_file: './peers.json'
                            }
                        });

                });

                beforeEach('start swarm', startSwarm);

                beforeEach('open ws connection and send msg', done =>
                    console.log(`{"bzn-api":"raft","cmd":"add_peer","data":{"peer":${scenarios[test].cmd}}}`) || openSocketAndSendMsg(done, `{"bzn-api":"raft","cmd":"add_peer","data":{"peer":${scenarios[test].cmd}}}`));

                beforeEach('spawn new peer', () => {
                    newPeer = spawn('script', ['-q', '/dev/null', './run-daemon.sh', 'bluzelle2.json'], {cwd: './scripts'});

                    newPeer.stdout.on('data', () => {});
                });

                beforeEach('populate db', done =>
                    createKeys(done, api, process.env.numOfKeys));

                afterEach('kill swarm', killSwarm);

                it('should not be able to communicate with swarm', async () => {

                    return new Promise((res, rej) => {
                        newPeer.stdout.on('data', data => {

                            if (data.toString().includes('Received WS message:')) {
                                rej(new Error('New peer connected to swarm. Expected to be singleton.'))
                            }

                        });

                        setTimeout(res, 3000)
                    })

                })

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
