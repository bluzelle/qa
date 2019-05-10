const {exec, spawn} = require('child_process');
const {readDaemonFile, writeDaemonFile, getDaemonOutputDir} = require('../../src/FileService');
const {generateSwarm} = require('../../src/daemonManager');


describe('daemon startup', function () {

    const DAEMON_OBJ = {
        listener_port: 50000,
        directory_name: 'daemon-50000',
        config_name: 'bluzelle-50000.json'
    };

    beforeEach('generate configs and set harness state', function () {
        this.swarm = generateSwarm({numberOfDaemons: 1});
    });

    afterEach('remove configs and peerslist and clear harness state', async function () {
        await this.swarm.stop();
        this.swarm.removeSwarmState();
    });

    describe('cmd line', function () {

        context('accepts flags', function () {

            it('accepts -h', function (done) {
                exec(`cd ${getDaemonOutputDir(DAEMON_OBJ)}; ./swarm -h`, (error, stdout, stderr) => {
                    if (stdout.includes('bluzelle [OPTION]')) {
                        done()
                    }
                })
            });

            it('accepts -c', function (done) {
                exec(`cd ${getDaemonOutputDir(DAEMON_OBJ)}; ./swarm -c`, (error, stdout, stderr) => {
                    if (stderr.includes("ERROR: the required argument for option '--config' is missing")) {
                        done()
                    }
                })
            });

        });
    });

    context('required arguments in config file', function () {

        const requiredArgumentsTests = [
            {argument: 'listener_address'},
            {argument: 'listener_port'},
            {argument: 'ethereum_io_api_token'},
            {argument: 'ethereum'}];

        Object.defineProperties(requiredArgumentsTests, {
            testErrorMessage: {value: function (obj) { return `the option '--${obj.argument}' is required but missing` }},
            name: {value: function (obj) { return `should throw "the option '--${obj.argument}' is required but missing" error`}}
        });

        requiredArgumentsTests.forEach(ctx => {
            context(`missing ${ctx.argument}`, function () {

                beforeEach('edit config file', function () {
                    const configFile = readDaemonFile(DAEMON_OBJ, DAEMON_OBJ.config_name).run();
                    delete configFile[ctx.argument];

                    writeDaemonFile(DAEMON_OBJ, DAEMON_OBJ.config_name, configFile).run();
                });

                it(requiredArgumentsTests.name(ctx), function (done) {
                    exec(`cd ${getDaemonOutputDir(DAEMON_OBJ)}; ./swarm -c ${DAEMON_OBJ.config_name}`, (error, stdout, stderr) => {
                        if (error.message.includes(requiredArgumentsTests.testErrorMessage(ctx))) {
                            done()
                        }
                    })
                });

            });
        });

        context('ethereum address', function () {

            context('with valid address', function () {

                context('with balance > 0', function () {

                    it('successfully starts up', async function () {
                        await this.swarm.start();
                    });
                });

                context('with balance <= 0', function () {

                    beforeEach('edit config file', function () {
                        const configFile = readDaemonFile(DAEMON_OBJ, DAEMON_OBJ.config_name).run();
                        configFile.ethereum = '0x20B289a92d504d82B1502996b3E439072FC66489';

                        writeDaemonFile(DAEMON_OBJ, DAEMON_OBJ.config_name, configFile).run();
                    });

                    it('fails to start up', (done) => {

                        exec(`cd ${getDaemonOutputDir(DAEMON_OBJ)}; ./swarm -c ${DAEMON_OBJ.config_name}`, (error, stdout, stderr) => {

                            if (stdout.includes(`No ETH balance found`)) {
                                done()
                            }
                        })

                    });
                })
            });

            context('with invalid address', function () {

                beforeEach('edit config file', function () {
                    const configFile = readDaemonFile(DAEMON_OBJ, DAEMON_OBJ.config_name).run();
                    configFile.ethereum = 'asdf';

                    writeDaemonFile(DAEMON_OBJ, DAEMON_OBJ.config_name, configFile).run();
                });

                it('fails to start up', function (done) {

                    exec(`cd ${getDaemonOutputDir(DAEMON_OBJ)}; ./swarm -c ${DAEMON_OBJ.config_name}`, (error, stdout, stderr) => {

                        if (stderr.includes('Invalid Ethereum address asdf')) {
                            done()
                        }
                    })
                });
            });
        });

        context('bootstrap file', function () {

            beforeEach('edit config file', function () {
                const configFile = readDaemonFile(DAEMON_OBJ, DAEMON_OBJ.config_name).run();
                delete configFile.bootstrap_file;

                writeDaemonFile(DAEMON_OBJ, DAEMON_OBJ.config_name, configFile).run();
            });

            it('throws "Bootstrap peers source not specified" error if not present', function (done) {
                exec(`cd ${getDaemonOutputDir(DAEMON_OBJ)}; ./swarm -c ${DAEMON_OBJ.config_name}`, (error, stdout, stderr) => {
                    if (error.message.includes('Bootstrap peers source not specified')) {
                        done()
                    }
                })
            });
        });
    });
});
