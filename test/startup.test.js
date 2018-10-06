const {exec, spawn} = require('child_process');

const {killSwarm, clearDaemonState, deleteConfigs} = require('../utils/daemon/setup');
const {editFile, generateJsonsAndSetState, resetHarnessState} = require('../utils/daemon/configs');


describe('daemon startup', () => {

    beforeEach('clear daemon state state', clearDaemonState);

    beforeEach('generate configs and set harness state', async () =>
        await generateJsonsAndSetState(1));

    afterEach('remove configs and peerslist and clear harness state', () => {
        deleteConfigs();
        resetHarnessState();
    });

    describe('cmd line', () => {

        context('accepts flags', () => {

            it('accepts -h', (done) => {

                exec('cd ./daemon-build/output/; ./swarm -h', (error, stdout, stderr) => {
                    if (stdout.includes('bluzelle [OPTION]')) {
                        done()
                    }
                })
            });

            it('accepts -c', (done) => {

                exec('cd ./daemon-build/output/; ./swarm -c', (error, stdout, stderr) => {
                    if (stderr.includes("ERROR: the required argument for option '--config' is missing")) {
                        done()
                    }
                })
            })

        });

        context('accepts time scaling env variable', () => {

            afterEach(killSwarm);

            context('with valid value', () => {

                it('successfully changes time scale', (done) => {

                    node = spawn('script', ['-q', '/dev/null', './run-daemon.sh', 'bluzelle0.json', 'env RAFT_TIMEOUT_SCALE=2'], {cwd: './scripts'});

                    node.stdout.on('data', (data) => {
                        if (data.toString().includes('RAFT_TIMEOUT_SCALE: 2')) {
                            done()
                        }
                    })
                });
            });

            context('without env variable', () => {

                it('time scale is unchanged at 1', (done) => {

                    node = spawn('script', ['-q', '/dev/null', './run-daemon.sh', 'bluzelle0.json'], {cwd: './scripts'});

                    node.stdout.on('data', (data) => {
                        if (data.toString().includes('RAFT_TIMEOUT_SCALE: 1')) {
                            done()
                        }
                    })
                });
            });

            context('with invalid value', () => {

                it('time scale is unchanged at 1', (done) => {

                    node = spawn('script', ['-q', '/dev/null', './run-daemon.sh', 'bluzelle0.json', 'env RAFT_TIMEOUT_SCALE=abcdef'], {cwd: './scripts'});

                    node.stdout.on('data', (data) => {
                        if (data.toString().includes('RAFT_TIMEOUT_SCALE: 1')) {
                            done()
                        }
                    });

                });
            });
        });
    });

    context('required arguments in config file', () => {

        context('listener address', () => {

            beforeEach(() =>
                editFile({filename: 'bluzelle0.json', deleteKey: ['listener_address']}));

            it('throws error if not present', (done) => {

                spawnAndRead(done, "the option 'listener_address' is required but missing");

            });

        });

        context('listener port', () => {

            beforeEach(() =>
                editFile({filename: 'bluzelle0.json', deleteKey: ['listener_port']}));

            it('throws error if not present', (done) => {
                spawnAndRead(done, "the option 'listener_port' is required but missing");
            });

        });

        context('ethereum io api token', () => {

            beforeEach(() =>
                editFile({filename: 'bluzelle0.json', deleteKey: ['ethereum_io_api_token']}));

            it('throws error if not present', (done) => {
                spawnAndRead(done, "the option 'ethereum_io_api_token' is required but missing");
            });

        });

        context('ethereum address', () => {

            context('missing', () => {

                beforeEach(() =>
                    editFile({filename: 'bluzelle0.json', deleteKey: ['ethereum']}));

                it('throws error', (done) => {
                    spawnAndRead(done, "the option 'ethereum' is required but missing");
                });

            });

            afterEach(killSwarm);

            context('with valid address', () => {

                context('with balance > 0', () => {

                    it('successfully starts up', (done) => {

                        spawnAndRead(done, 'Running node with ID:');

                    });
                });

                context('with balance <= 0', () => {

                    beforeEach(() =>
                        editFile({
                            filename: 'bluzelle0.json',
                            changes: {ethereum: '0x20B289a92d504d82B1502996b3E439072FC66489'}
                        }));

                    it('fails to start up', (done) => {

                        spawnAndRead(done, 'No ETH balance found');

                    });
                })
            });

            context('with invalid address', () => {

                beforeEach(() =>
                    editFile({filename: 'bluzelle0.json', changes: {ethereum: 'asdf'}}));

                it('fails to start up', (done) => {

                    spawnAndRead(done, 'Invalid Ethereum address asdf');

                });
            });
        });


        context('bootstrap file', () => {

            beforeEach(() =>
                editFile({filename: 'bluzelle0.json', deleteKey: ['bootstrap_file']}));

            it('throws error if not present', (done) => {
                spawnAndRead(done, 'Bootstrap peers source not specified');
            });
        });

        context('uuid', () => {

            beforeEach(() =>
                editFile({filename: 'bluzelle0.json', deleteKey: ['uuid']}));

            it('throws error if not present', (done) => {
                spawnAndRead(done, 'Failed to read pem file: .state/public-key.pem');

            });

        });
    });

    context('optional arguments in config file', () => {

        context('http_port', () => {

            context('does not exist', () => {

                beforeEach('remove http_port setting', () =>
                    editFile({filename: 'bluzelle0.json', deleteKey: ['http_port']}));

                beforeEach('start daemon', (done) => {
                    let node = spawn('script', ['-q', '/dev/null', './run-daemon.sh', 'bluzelle0.json'], {cwd: './scripts'});

                    node.stdout.on('data', (data) => {
                        if (data.toString().includes('Running node with ID:')) {
                            done()
                        }
                    })
                });

                afterEach('kill daemon', killSwarm);

                it('should default to 8080', (done) => {
                    exec('lsof -i:8080', (error, stdout, stderr) => {
                        if (stdout.includes('swarm')) {
                            done()
                        }
                    });

                });
            });

            context('exists', () => {

                beforeEach('remove http_port setting', () =>
                    editFile({filename: 'bluzelle0.json', changes: {http_port: 8081}}));

                beforeEach('start daemon', (done) => {
                    let node = spawn('script', ['-q', '/dev/null', './run-daemon.sh', 'bluzelle0.json'], {cwd: './scripts'});

                    node.stdout.on('data', (data) => {
                        if (data.toString().includes('Running node with ID:')) {
                            done()
                        }
                    })
                });

                afterEach('kill daemon', killSwarm);

                it('should override default port', (done) => {

                    exec('lsof -i:8081', (error, stdout, stderr) => {
                        if (stdout.includes('swarm')) {
                            done()
                        }
                    });
                });
            });
        });

        context('max storage', () => {

            afterEach('kill swarm', killSwarm);


            context('does not exist', () => {

                beforeEach(() =>
                    editFile({filename: 'bluzelle0.json', deleteKey: ['max_storage']}));

                it('should default to 2GB', (done) => {

                    spawnAndRead(done, 'Maximum Storage: 2147483648 Bytes');
                });
            });

            context('exists', () => {

                beforeEach(() =>
                    editFile({filename: 'bluzelle0.json', changes: {max_storage: '5000B'}}));

                it('should override default limit', (done) => {

                    spawnAndRead(done, 'Maximum Storage: 5000 Bytes');

                });
            });
        });
    });
});

const spawnAndRead = (done, matchStr) => {

    let node = spawn('script', ['-q', '/dev/null', './run-daemon.sh', 'bluzelle0.json'], {cwd: './scripts'});

    node.stdout.on('data', (data) => {

        if (data.toString().includes(matchStr)) {
            done()
        }
    })
};
