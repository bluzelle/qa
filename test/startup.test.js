const expect = require('chai').expect;
const waitUntil = require("async-wait-until");
const {exec, spawn} = require('child_process');
const {includes} = require('lodash');

const {fileExists, fileMoved, readFile} = require('../utils/daemon/logs');
const {startSwarm, killSwarm} = require('../utils/daemon/setup');
const {editFile} = require('../utils/daemon/configs');

let logFileName;

describe('daemon startup', () => {

    describe('cmd line', () => {

        context('accepts flags', () => {

            it('accepts -h', done => {
                execAndRead('./swarm -h', 'bluzelle [OPTION]', done);
            });

            it('accepts -c', done => {
                execAndRead('./swarm -c', 'ERROR: the required argument for option \'--config\' is missing', done);
            })

        });

        context('accepts time scaling env variable', () => {

            afterEach(() => killSwarm(logFileName));

            context('with valid value', () => {

                it('successfully changes time scale', async () => {
                    exec('cd ./scripts; ./run-daemon.sh bluzelle0.json "env RAFT_TIMEOUT_SCALE=2"');

                    await waitUntil(() => logFileName = fileExists());

                    await waitUntil(() => includes(readFile('output/', logFileName), 'RAFT_TIMEOUT_SCALE: 2'));
                });
            });

            context('without env variable', () => {

                it('time scale is unchanged at 1', async () => {
                    exec('cd ./scripts; ./run-daemon.sh bluzelle0.json');

                    await waitUntil(() => logFileName = fileExists());

                    await waitUntil(() => includes(readFile('output/', logFileName), 'RAFT_TIMEOUT_SCALE: 1'));
                });
            });

            context('with invalid value', () => {

                it('time scale is unchanged at 1', async () => {
                    exec('cd ./scripts; ./run-daemon.sh bluzelle0.json "env RAFT_TIMEOUT_SCALE=asdf"');

                    await waitUntil(() => logFileName = fileExists());

                    await waitUntil(() => includes(readFile('output/', logFileName), 'RAFT_TIMEOUT_SCALE: 1'));
                });
            });
        });
    });

    context('required arguments in config file', () => {

        context('listener address', () => {

            beforeEach(() =>
                editFile({filename: 'bluzelle2.json', deleteKey: ['listener_address']}));

            it('throws error if not present', done => {
                execAndRead('./swarm -c bluzelle2.json', 'Missing listener address entry!', done);
            });

        });

        context('listener port', () => {

            beforeEach(() =>
                editFile({filename: 'bluzelle2.json', deleteKey: ['listener_port']}));

            it('throws error if not present', done => {
                execAndRead('./swarm -c bluzelle2.json', 'Missing listener port entry!', done);
            });

        });

        context('ethereum address', () => {

            context('missing', () => {

                beforeEach(() =>
                    editFile({filename: 'bluzelle2.json', deleteKey: ['ethereum']}));

                it('throws error', done => {
                    execAndRead('./swarm -c bluzelle2.json', 'Missing Ethereum address entry!', done);
                });

            });


            afterEach(() => exec('pkill -2 swarm'));

            context('with valid address', () => {

                context('with balance > 0', () => {

                    it('successfully starts up', async () => {

                        exec('cd ./scripts; ./run-daemon.sh bluzelle0.json');

                        await waitUntil(() => logFileName = fileExists());

                        await waitUntil(() => includes(readFile('output/', logFileName), 'Running node with ID:'));

                    });
                });

                context('with balance <= 0', () => {

                    beforeEach(() =>
                        editFile({filename: 'bluzelle2.json', changes: { ethereum: '0x20B289a92d504d82B1502996b3E439072FC66489'}}));

                    it('fails to start up', done => {

                        exec('cd ./scripts; ./run-daemon.sh bluzelle2.json', (error, stdout) => {
                            if (error) {
                                console.error(`exec error: ${error}`);
                                return;
                            }

                            if (stdout.includes('No ETH balance found')) {
                                done();
                            }
                        });

                    });
                })
            });

            context('with invalid address', () => {

                beforeEach(() =>
                    editFile({filename: 'bluzelle2.json', changes: { ethereum: 'asdf' }}));

                it('fails to start up', done => {

                    const node = spawn('./run-daemon.sh', ['bluzelle2.json'], {cwd: './scripts'});

                    node.stderr.on('data', (data) => {
                        if (data.toString().includes('Invalid Ethereum address: asdf')) {
                            done();
                        }
                    });

                });
            });
        });

        context('ethereum io api token', () => {

            beforeEach(() =>
                editFile({filename: 'bluzelle2.json', deleteKey: ['ethereum_io_api_token']}));

            it('throws error if not present', done => {
                execAndRead('./swarm -c bluzelle2.json', 'Missing Ethereum IO API token entry!', done);
            });

        });

        context('bootstrap file', () => {

            beforeEach(() =>
                editFile({filename: 'bluzelle2.json', deleteKey: ['bootstrap_file']}));

            // no missing peers list file error msg
            it.skip('throws error if not present', done => {
                execAndRead('./swarm -c bluzelle2.json', 'Missing peers list entry!', done);
            });
        });

        context('uuid', () => {

            beforeEach(() =>
                editFile({filename: 'bluzelle2.json', deleteKey: ['uuid']}));

            // no missing uuid error msg
            it.skip('throws error if not present', done => {
                execAndRead('./swarm -c bluzelle2.json', 'Missing uuid entry!', done);
            });

        });
    });
});

const execAndRead = (cmd, matchStr, done) => {
    exec(`cd ./daemon-build/output/; ${cmd}`, (err, stdout, stderr) => {

        if (stdout.toString().includes(matchStr)) {
            done()
        }

        if (stderr.toString().includes(matchStr)) {
            done()
        } else if (stderr) {
            throw new Error(stderr)
        }

    });
};
