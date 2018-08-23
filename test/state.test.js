const {spawn, exec} = require('child_process');
const {expect} = require('chai');
const waitUntil = require("async-wait-until");
const {includes, filter} = require('lodash');

const {startSwarm, killSwarm, createState, createKeys} = require('../utils/daemon/setup');
const {readFile, readDir, compareData} = require('../utils/daemon/logs');
const {editFile} = require('../utils/daemon/configs');
const shared = require('./shared');
const api = require('../bluzelle-js/lib/bluzelle.node');


describe('storage', () => {

    beforeEach('initialize client api', () => {
        api.connect(`ws://${process.env.address}:${process.env.port}`, '71e2cd35-b606-41e6-bb08-f20de30df76c');
    });

    beforeEach('create state', async () => {
        await createState(api, 'stateExists', '123');
    });

    beforeEach(async () => {
        await startSwarm({maintainState: true});
    });

    beforeEach('populate db', done => {
        createKeys(done, api, process.env.numOfKeys);
    });

    afterEach(async () => {
        await killSwarm();
    });

    context('values', () => {

        it('should persist through shut down', async () => {
            expect(await api.read('stateExists')).to.equal('123');
        });

        it('should be persisted to .dat files for all nodes', async () => {
            await api.create('myKey', '123');
            expect(await api.read('myKey')).to.equal('123');

            await killSwarm();

            await waitUntil(() =>
                filter(readDir('output/'), contents => includes(contents, '.state'))[0]);

            let contents = readDir('output/.state/');
            expect(contents.length).to.be.equal(2)
        });
    });

    context('a new node, after connecting to peers', () => {

        it('should sync with swarm', done => {
            const node = spawn('./run-daemon.sh', ['bluzelle2.json'], {cwd: './scripts'});

            node.stdout.on('data', data => {

                if (data.toString().includes('current term out of sync:')) {
                    done();
                }
            });
        });

        it('should fully replicate .state file of leader', async () => {
            spawn('./run-daemon.sh', ['bluzelle2.json'], {cwd: './scripts'});

            let daemonData = {};

            await waitUntil(() => {

                const DAEMON_STORAGE_LOG_NAMES = readDir('output/.state').filter(file => file.endsWith('.dat'));

                DAEMON_STORAGE_LOG_NAMES.forEach(filename =>
                    daemonData[filename] = readFile('/output/.state/', filename));

                return compareData(daemonData);
            })
        });
    });

    context('limit', () => {

        context('when exceeded', () => {

            let node;

            beforeEach(() =>
                editFile({filename: 'bluzelle2.json', changes: {max_storage: '700B'}}));

            beforeEach(() => {
                node = spawn('./run-daemon.sh', ['bluzelle2.json'], {cwd: './scripts'});
            });

            beforeEach('create key, exceed limit', () =>
                api.create('key01', '123'));


            it('should log exceeded storage msg', async () => {

                await new Promise( resolve => {
                    node.stdout.on('data', data => {
                        if (data.toString().includes('Maximum storage has been exceeded, please update the options file.')) {
                            resolve();
                        }
                    });
                });
            });

            it('should stop', async () => {

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
                    node = spawn('script', ['-q' ,'/dev/null', './run-daemon.sh', 'bluzelle2.json'], {cwd: './scripts'});

                    await new Promise(resolve => {
                        node.stdout.on('data', data => {
                            // connected to peer log msg: [debug] (node.cpp:84) - connection from: 127.0.0.1:62506
                            if (data.toString().includes('connection from:')) {
                                resolve()
                            }
                        })
                    })
                });

                afterEach(killSwarm);

                context('daemon is operational', () => {

                    beforeEach(() => {
                        shared.connect(process.env.address, parseInt(process.env.port) + 2, '71e2cd35-b606-41e6-bb08-f20de30df76c');
                    });

                    shared.swarmIsOperational();
                });
            });
        });
    });
});



