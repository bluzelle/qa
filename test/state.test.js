const spawn = require('child_process').spawn;
const expect = require('chai').expect;
const waitUntil = require("async-wait-until");
const {includes, filter} = require('lodash');

const {startSwarm, killSwarm, createState} = require('../utils/daemon/setup');
const {fileExists, readFile, readDir, checkFilesConsistency} = require('../utils/daemon/logs');
const api = require('../bluzelle-js/src/api');


describe('states', () => {

    context('storage', () => {

        beforeEach('create state', async () => {
            await createState('key', 123);
        });

        beforeEach(async () => {
            await startSwarm(true);
            api.connect(`ws://${process.env.address}:${process.env.port}`, '71e2cd35-b606-41e6-bb08-f20de30df76c');
        });

        afterEach(async () => {
            await killSwarm();
        });

        context('values', () => {

            it.skip('should persist through shut down', async () => {
                expect(await api.read('key')).to.equal('hi');
            });
        });

        context('a new node, after connecting to peers', () => {

            const DAEMON_UUIDS = ["60ba0788-9992-4cdb-b1f7-9f68eef52ab9", "c7044c76-135b-452d-858a-f789d82c7eb7", "3726ec5f-72b4-4ce6-9e60-f5c47f619a41"];

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

                        DAEMON_UUIDS.forEach(v => {
                            daemonData[v] = readFile('/output/.state/', v + '.dat');
                        });

                        checkFilesConsistency(done, daemonData);
                    }
                });
            });
        });
    });

    context('committed value should be persisted to .state and .dat', () => {

        beforeEach(startSwarm);

        beforeEach(() =>
            api.connect(`ws://${process.env.address}:${process.env.port}`, '71e2cd35-b606-41e6-bb08-f20de30df76c'));

        it('should have .dat and .state file for both nodes', async () => {
            await api.create('myKey', 123);
            expect(await api.read('myKey')).to.equal(123);

            await killSwarm();

            await waitUntil(() =>
                filter(readDir('output/'), contents => includes(contents, '.state'))[0]);

            let contents = readDir('output/.state/');
            expect(contents.length).to.be.equal(4)
        });
    });
});



