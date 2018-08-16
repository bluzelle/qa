const {expect} = require('chai');
const waitUntil = require("async-wait-until");
const {exec, spawn} = require('child_process');
const {includes} = require('lodash');

const {readFile, readDir} = require('../utils/daemon/logs');
const {killSwarm} = require('../utils/daemon/setup');
const {editFile} = require('../utils/daemon/configs');

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

            afterEach(killSwarm);

            context('with valid value', () => {

                it('successfully changes time scale', async () => {

                    const logNames = await execAndReturnLogNames('cd ./scripts; ./run-daemon.sh bluzelle0.json "env RAFT_TIMEOUT_SCALE=2"');

                    await waitUntil(() => includes(readFile('output/logs/', logNames[0]), 'RAFT_TIMEOUT_SCALE: 2'));
                });
            });

            context('without env variable', () => {

                it('time scale is unchanged at 1', async () => {

                    const logNames = await execAndReturnLogNames('cd ./scripts; ./run-daemon.sh bluzelle0.json');

                    await waitUntil(() => includes(readFile('output/logs/', logNames[0]), 'RAFT_TIMEOUT_SCALE: 1'));
                });
            });

            context('with invalid value', () => {

                it('time scale is unchanged at 1', async () => {

                    const logNames = await execAndReturnLogNames('cd ./scripts; ./run-daemon.sh bluzelle0.json "env RAFT_TIMEOUT_SCALE=asdf"');

                    await waitUntil(() => includes(readFile('output/logs/', logNames[0]), 'Invalid RAFT_TIMEOUT_SCALE value: asdf'));
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

            afterEach(killSwarm);

            context('with valid address', () => {

                context('with balance > 0', () => {

                    it('successfully starts up', async () => {

                        const logNames = await execAndReturnLogNames('cd ./scripts; ./run-daemon.sh bluzelle0.json');

                        await waitUntil(() => includes(readFile('output/logs/', logNames[0]), 'Running node with ID:'));

                    });
                });

                context('with balance <= 0', () => {

                    beforeEach(() =>
                        editFile({
                            filename: 'bluzelle2.json',
                            changes: {ethereum: '0x20B289a92d504d82B1502996b3E439072FC66489'}
                        }));

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
                    editFile({filename: 'bluzelle2.json', changes: {ethereum: 'asdf'}}));

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

            it('throws error if not present', done => {
                execAndRead('./swarm -c bluzelle2.json', 'Missing Bootstrap URL or FILE entry!', done);
            });
        });

        context('uuid', () => {

            beforeEach(() =>
                editFile({filename: 'bluzelle2.json', deleteKey: ['uuid']}));

            it('throws error if not present', done => {
                execAndRead('./swarm -c bluzelle2.json', 'Missing UUID entry!', done);
            });

        });
    });

    context('optional arguments in config file', () => {
       context('http_port', () => {

           context('does not exist', () => {
               beforeEach('remove http_port setting', () =>
                   editFile({filename: 'bluzelle0.json', deleteKey: ['http_port']}));

               beforeEach('start daemon', () => {
                   exec('cd ./daemon-build/output/; ./swarm -c bluzelle0.json')
               });

               afterEach('kill daemon', killSwarm);

               it('defaults to 8080', done => {

                   setTimeout(() => {
                       exec('lsof -i:8080', (error, stdout, stderr) => {
                           if (stdout.includes('swarm')) {
                               done()
                           }
                       });
                   }, 1000)
               });
           });

           context('exists', () => {
               beforeEach('remove http_port setting', () =>
                   editFile({filename: 'bluzelle0.json', changes: { http_port: 8081 }}));

               beforeEach('start daemon', () => {
                   exec('cd ./daemon-build/output/; ./swarm -c bluzelle0.json')
               });

               afterEach('kill daemon', killSwarm);

               it('overrides default port', done => {

                   setTimeout(() => {
                       exec('lsof -i:8081', (error, stdout, stderr) => {
                           if (stdout.includes('swarm')) {
                               done()
                           }
                       });
                   }, 1000)
               });
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

const execAndReturnLogNames = async (cmd) => {
    let beforeContents = readDir('output/logs');

    exec(cmd);

    let afterContents;

    try {
        await waitUntil(() => {
            afterContents = readDir('output/logs');

            if (afterContents.length === beforeContents.length + 1) {
                return afterContents
            }
        })
    } catch (error) {
        process.env.quiet ||
        console.log('\x1b[36m%s\x1b[0m', 'Failed to find new logs')
    }

    return difference(beforeContents, afterContents);
};

const difference = (arr1, arr2) => {
    return arr1
        .filter(item => !arr2.includes(item))
        .concat(arr2.filter(item => !arr1.includes(item)));
};
