const {exec, spawn} = require('child_process');
const waitUntil = require("async-wait-until");

const {despawnSwarm, deleteConfigs} = require('../utils/daemon/setup');
const {editFile, generateSwarmConfigsAndSetState, resetHarnessState} = require('../utils/daemon/configs');


describe('daemon startup', () => {

    beforeEach('generate configs and set harness state', async () =>
        await generateSwarmConfigsAndSetState(1));

    afterEach('remove configs and peerslist and clear harness state', () => {
        deleteConfigs();
        resetHarnessState();
    });

    describe('cmd line', () => {

        context('accepts flags', () => {

            it('accepts -h', async () => new Promise((resolve) => {

                exec('cd ./daemon-build/output/; ./swarm -h', (error, stdout, stderr) => {
                    if (stdout.includes('bluzelle [OPTION]')) {
                        resolve()
                    }
                })
            }));

            it('accepts -c', async () => new Promise((resolve) => {

                exec('cd ./daemon-build/output/; ./swarm -c', (error, stdout, stderr) => {
                    if (stderr.includes("ERROR: the required argument for option '--config' is missing")) {
                        resolve()
                    }
                })
            }))

        });

        context('accepts time scaling env variable', () => {

            afterEach(despawnSwarm);

            context('with valid value', () => {

                it('successfully changes time scale', async () => new Promise((resolve) => {

                    node = spawn('script', ['-q', '/dev/null', './run-daemon.sh', 'bluzelle0.json', 'env RAFT_TIMEOUT_SCALE=2'], {cwd: './scripts'});

                    node.stdout.on('data', (data) => {
                        if (data.toString().includes('RAFT_TIMEOUT_SCALE: 2')) {
                            resolve()
                        }
                    })
                }));
            });

            context('without env variable', () => {

                it('time scale is unchanged at 1', async () => new Promise((resolve) => {

                    node = spawn('script', ['-q', '/dev/null', './run-daemon.sh', 'bluzelle0.json'], {cwd: './scripts'});

                    node.stdout.on('data', (data) => {
                        if (data.toString().includes('RAFT_TIMEOUT_SCALE: 1')) {
                            resolve()
                        }
                    })
                }));
            });

            context('with invalid value', () => {

                it('time scale is unchanged at 1', async () => new Promise((resolve) => {

                    node = spawn('script', ['-q', '/dev/null', './run-daemon.sh', 'bluzelle0.json', 'env RAFT_TIMEOUT_SCALE=abcdef'], {cwd: './scripts'});

                    node.stdout.on('data', (data) => {
                        if (data.toString().includes('RAFT_TIMEOUT_SCALE: 1')) {
                            resolve()
                        }
                    });

                }));
            });
        });
    });

    context('required arguments in config file', () => {

        context('listener address', () => {

            beforeEach(() =>
                editFile({filename: 'bluzelle0.json', deleteKey: ['listener_address']}));

            it('throws error if not present', async () => {

                await spawnAndRead("the option 'listener_address' is required but missing");

            });

        });

        context('listener port', () => {

            beforeEach(() =>
                editFile({filename: 'bluzelle0.json', deleteKey: ['listener_port']}));

            it('throws error if not present', async () => {
                await spawnAndRead("the option 'listener_port' is required but missing");
            });

        });

        context('ethereum io api token', () => {

            beforeEach(() =>
                editFile({filename: 'bluzelle0.json', deleteKey: ['ethereum_io_api_token']}));

            it('throws error if not present', async () => {
                await spawnAndRead("the option 'ethereum_io_api_token' is required but missing");
            });

        });

        context('ethereum address', () => {

            context('missing', () => {

                beforeEach(() =>
                    editFile({filename: 'bluzelle0.json', deleteKey: ['ethereum']}));

                it('throws error', async () => {
                    await spawnAndRead("the option 'ethereum' is required but missing");
                });

            });

            context('with valid address', () => {

                context('with balance > 0', () => {

                    afterEach(despawnSwarm);

                    it('successfully starts up', async () => {

                        await spawnAndRead('Running node with ID:');

                    });
                });

                context('with balance <= 0', () => {

                    beforeEach(() =>
                        editFile({
                            filename: 'bluzelle0.json',
                            changes: {ethereum: '0x20B289a92d504d82B1502996b3E439072FC66489'}
                        }));

                    it('fails to start up', async () => {

                        await spawnAndRead('No ETH balance found');

                    });
                })
            });

            context('with invalid address', () => {

                beforeEach(() =>
                    editFile({filename: 'bluzelle0.json', changes: {ethereum: 'asdf'}}));

                it('fails to start up', async () => {

                    await spawnAndRead('Invalid Ethereum address asdf');

                });
            });
        });


        context('bootstrap file', () => {

            beforeEach(() =>
                editFile({filename: 'bluzelle0.json', deleteKey: ['bootstrap_file']}));

            it('throws error if not present', async () => {
                await spawnAndRead('Bootstrap peers source not specified');
            });
        });

        context('uuid', () => {

            beforeEach(() =>
                editFile({filename: 'bluzelle0.json', deleteKey: ['uuid']}));

            it('throws error if not present', async () => {
                await spawnAndRead('Failed to read pem file: .state/public-key.pem');

            });

        });
    });

    context('optional arguments in config file', () => {

        context('http_port', () => {

            context('does not exist', () => {

                beforeEach('remove http_port setting', () =>
                    editFile({filename: 'bluzelle0.json', deleteKey: ['http_port']}));

                beforeEach('start daemon', async () => new Promise((resolve) => {
                    let node = spawn('script', ['-q', '/dev/null', './run-daemon.sh', 'bluzelle0.json'], {cwd: './scripts'});

                    node.stdout.on('data', (data) => {
                        if (data.toString().includes('Running node with ID:')) {
                            resolve()
                        }
                    })
                }));

                afterEach('kill daemon', despawnSwarm);

                it('should default to 8080', async () => {
                    await waitUntil(() => {
                        return exec('lsof -i:8080', (error, stdout, stderr) => {
                            return stdout.includes('swarm')
                        });
                    })
                })
            });

            context('exists', () => {

                beforeEach('remove http_port setting', () =>
                    editFile({filename: 'bluzelle0.json', changes: {http_port: 8081}}));

                beforeEach('start daemon', async () => new Promise((resolve) => {
                    let node = spawn('script', ['-q', '/dev/null', './run-daemon.sh', 'bluzelle0.json'], {cwd: './scripts'});

                    node.stdout.on('data', (data) => {
                        if (data.toString().includes('Running node with ID:')) {
                            resolve()
                        }
                    })
                }));

                afterEach('kill daemon', despawnSwarm);

                it('should override default port', async () => {
                    await waitUntil(() => {
                        return exec('lsof -i:8081', (error, stdout, stderr) => {
                            return stdout.includes('swarm')
                        });
                    })
                });
            });
        });

        context('max storage', () => {

            afterEach('kill swarm', despawnSwarm);


            context('does not exist', () => {

                beforeEach(() =>
                    editFile({filename: 'bluzelle0.json', deleteKey: ['max_storage']}));

                it('should default to 2GB', async () => {

                    await spawnAndRead('Maximum Storage: 2147483648 Bytes');
                });
            });

            context('exists', () => {

                beforeEach(() =>
                    editFile({filename: 'bluzelle0.json', changes: {max_storage: '5000B'}}));

                it('should override default limit', async () => {

                    await spawnAndRead('Maximum Storage: 5000 Bytes');

                });
            });
        });
    });
});

const spawnAndRead = (matchStr) => new Promise((resolve) => {

    let node = spawn('script', ['-q', '/dev/null', './run-daemon.sh', 'bluzelle0.json'], {cwd: './scripts'});

    node.stdout.on('data', (data) => {

        if (data.toString().includes(matchStr)) {
            resolve()
        }
    })
});
