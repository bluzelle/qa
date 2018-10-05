const {spawn, exec} = require('child_process');
const {expect} = require('chai');

const {startSwarm, killSwarm, createState, createKeys} = require('../utils/daemon/setup');
const {editFile} = require('../utils/daemon/configs');
const shared = require('./shared');
const api = require('../bluzelle-js/lib/bluzelle-node');


let numOfKeys = 5;

describe('storage', () => {

    beforeEach('create state', async () => {
        await createState(api, 'stateExists', '123');
    });

    beforeEach(async () => {
        await startSwarm({maintainState: true});
    });

    beforeEach('initialize client api', async () =>
        await api.connect(`ws://${process.env.address}:${process.env.port}`, '71e2cd35-b606-41e6-bb08-f20de30df76c'));

    beforeEach('populate db', done => {
        createKeys(done, api, numOfKeys);
    });

    afterEach('disconnect api', api.disconnect);

    afterEach(async () => {
        await killSwarm();
    });

    context('values', () => {

        it('should persist through shut down', async () => {
            expect(await api.read('stateExists')).to.equal('123');
        });

    });

    context('a new node, after connecting to peers', () => {

        shared.daemonShouldSync(api, 'bluzelle2', numOfKeys + 1);

    });

    context('limit', () => {

        context('when exceeded', () => {

            let node;

            beforeEach('edit config', () =>
                editFile({filename: 'bluzelle2.json', changes: {max_storage: '700B'}}));

            beforeEach('spawn node', () => {
                node = spawn('script', ['-q', '/dev/null', './run-daemon.sh', 'bluzelle2.json'], {cwd: './scripts'});
            });

            beforeEach('create key, exceed limit', () => {
                api.create('key01', '123');
            });

            it('should log exceeded storage msg', async () => {

                await new Promise(resolve => {
                    node.stdout.on('data', data => {
                        if (data.toString().includes('Maximum storage has been exceeded, please update the options file.')) {
                            resolve();
                        }
                    });
                });
            });

            it('should exit', async () => {

                await new Promise(resolve => {
                    node.on('close', code => {
                        resolve()
                    });
                });
            });

            it('should fail to restart', async () => {

                await new Promise(resolve => {
                    node.on('close', code => {
                        resolve()
                    });
                });

                await new Promise(resolve => {
                    exec('cd ./daemon-build/output/; ./swarm -c bluzelle2.json', (error, stdout, stderr) => {
                        if (stdout.toString().includes('Maximum storage has been exceeded')) {
                            resolve()
                        }
                    });
                });
            });

            context('if limit increased', () => {

                beforeEach('wait until exceeded daemon is stopped', async () => {
                    await new Promise(resolve => {
                        node.on('close', code => {
                            resolve()
                        });
                    });
                });

                beforeEach('edit file', () =>
                    editFile({filename: 'bluzelle2.json', changes: {max_storage: '1GB'}}));

                beforeEach('start daemon with increased limit', async () => {
                    node = spawn('script', ['-q', '/dev/null', './run-daemon.sh', 'bluzelle2.json'], {cwd: './scripts'});

                    await new Promise(resolve => {
                        node.stdout.on('data', data => {
                            // connected to peer log msg: [debug] (node.cpp:84) - connection from: 127.0.0.1:62506
                            if (data.toString().includes('Received WS message:')) {
                                resolve()
                            }
                        })
                    })
                });

                context('daemon is operational', () => {

                    shared.swarmIsOperational(api);
                });
            });
        });
    });
});



