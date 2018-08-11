const {spawn} = require('child_process');
const {expect} = require('chai');
const waitUntil = require("async-wait-until");
const {includes, filter} = require('lodash');

const {startSwarm, killSwarm, createState} = require('../utils/daemon/setup');
const {fileExists, readFile, readDir, compareData} = require('../utils/daemon/logs');
const api = require('../bluzelle-js/lib/bluzelle.node');


describe('states', () => {

    context('storage', () => {

        beforeEach('create state', async () => {
            await createState('key', '123');
        });

        beforeEach(async () => {
            await startSwarm(true);
            api.connect(`ws://${process.env.address}:${process.env.port}`, '71e2cd35-b606-41e6-bb08-f20de30df76c');
        });

        afterEach(async () => {
            await killSwarm();
        });

        context('values', () => {

            it('should persist through shut down', async () => {
                expect(await api.read('key')).to.equal('123');
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

            it('should fully replicate .state file of leader', done => {
                const node = spawn('./run-daemon.sh', ['bluzelle2.json'], {cwd: './scripts'});

                let daemonData = {};

                node.stdout.on('data', data => {

                    if (data.toString().includes('current term out of sync:')) {

                        const DAEMON_STORAGE_LOG_NAMES = readDir('output/.state').filter(file => file.endsWith('.dat'));

                        DAEMON_STORAGE_LOG_NAMES.forEach(filename =>
                            daemonData[filename] = readFile('/output/.state/', filename));

                        compareData(done, daemonData);
                    }
                });
            });
        });
    });

    context('committed value should be persisted to .dat', () => {

        beforeEach(startSwarm);

        beforeEach(() =>
            api.connect(`ws://${process.env.address}:${process.env.port}`, '71e2cd35-b606-41e6-bb08-f20de30df76c'));

        it('should have .dat file for both nodes', async () => {
            await api.create('myKey', '123');
            expect(await api.read('myKey')).to.equal('123');

            await killSwarm();

            await waitUntil(() =>
                filter(readDir('output/'), contents => includes(contents, '.state'))[0]);

            let contents = readDir('output/.state/');
            expect(contents.length).to.be.equal(2)
        });
    });
});



