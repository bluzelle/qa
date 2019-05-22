const execa = require('execa');
const {readDaemonFile, writeDaemonFile, getDaemonOutputDir} = require('../../src/FileService');
const {generateSwarm} = require('../../src/daemonManager');

const DAEMON_OBJ = {
    listener_port: 50000,
    directory_name: 'daemon-50000',
    config_name: 'bluzelle-50000.json'
};

describe('daemon startup', function () {

    beforeEach('generate configs and set harness state', function () {
        this.swarm = generateSwarm({numberOfDaemons: 1});
    });

    afterEach('remove configs and peerslist and clear harness state', async function () {
        await this.swarm.stop();
        this.swarm.removeSwarmState();
    });

    describe('cmd line', function () {

        context('accepts flags', function () {

            const acceptsFlagsTests = [
                {argument: '-h', outputStream: 'stdout', expectedOutput: 'bluzelle [OPTION]'},
                {argument: '-c', outputStream: 'stderr', expectedOutput: "ERROR: the required argument for option '--config' is missing"}
            ];

            acceptsFlagsTests.forEach(ctx => {
                it(`accepts ${ctx.argument}`, function (done) {
                    if (launchDaemon(ctx.argument)[ctx.outputStream].includes(ctx.expectedOutput)) {
                        done();
                    }
                });
            });
        });
    });

    context('required arguments in config file', function () {

        const requiredArgumentsTests = [
            {argument: 'listener_address'},
            {argument: 'listener_port'},
            {argument: 'ethereum_io_api_token'},
            {argument: 'ethereum'}];

        requiredArgumentsTests.forEach(ctx => {

            context(`missing ${ctx.argument}`, function () {

                beforeEach('edit config file', function () {
                    const configFile = readDaemonFile(DAEMON_OBJ, DAEMON_OBJ.config_name).run();
                    delete configFile[ctx.argument];

                    writeDaemonFile(DAEMON_OBJ, DAEMON_OBJ.config_name, configFile).run();
                });

                it(`should throw "the option '--${ctx.argument}' is required but missing" error`, function (done) {
                    if (launchDaemon(['-c', DAEMON_OBJ.config_name]).stdout.includes(`the option '--${ctx.argument}' is required but missing`)) {
                        done();
                    }
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
                        if (launchDaemon(['-c', DAEMON_OBJ.config_name]).stdout.includes('No ETH balance found')) {
                            done();
                        }
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
                    if (launchDaemon(['-c', DAEMON_OBJ.config_name]).stderr.includes('Invalid Ethereum address asdf')) {
                        done();
                    }
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
                if (launchDaemon(['-c', DAEMON_OBJ.config_name]).stderr.includes('Bootstrap peers source not specified')) {
                    done();
                }
            });
        });
    });
});

function launchDaemon(swarmExecutableArguments) {
    const argumentsArray = Array.isArray(swarmExecutableArguments) ? swarmExecutableArguments : [swarmExecutableArguments];
    return execa.sync('./swarm', argumentsArray, {cwd: getDaemonOutputDir(DAEMON_OBJ), reject: false});
};
