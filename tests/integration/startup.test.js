const {swarmManager} = require('../../src/swarmManager');
const execa = require('execa');
const {getDaemonOutputDir} = require('../../src/FileService');
const {editConfigFile} = require('../../src/utils');
const {stopSwarmsAndRemoveStateHook} = require('../shared/hooks');

const DAEMON_OBJ = {
    listener_port: 50000,
    swarm_id: 'swarm0',
    directory_name: 'daemon-50000',
    config_name: 'bluzelle-50000.json'
};

describe('daemon startup', function () {

    beforeEach('generate configs and set harness state', async function () {
        this.swarmManager = await swarmManager();
        this.swarm = await this.swarmManager.generateSwarm({numberOfDaemons: 1});
    });

    stopSwarmsAndRemoveStateHook({afterHook: afterEach, preserveSwarmState: false});

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
            {argument: 'stack'}
        ];

        requiredArgumentsTests.forEach(ctx => {

            context(`missing ${ctx.argument}`, function () {

                beforeEach('edit config file', function () {
                    editConfigFile(DAEMON_OBJ, null, [ctx.argument]);
                });

                it(`should throw "the option '--${ctx.argument}' is required but missing" error`, function (done) {
                    if (launchDaemon(['-c', DAEMON_OBJ.config_name]).stdout.includes(`the option '--${ctx.argument}' is required but missing`)) {
                        done();
                    }
                });

            });
        });
    });

    context('esr location', function () {

        context('default', function () {

            beforeEach('edit config file', function () {
                editConfigFile(DAEMON_OBJ, null, ['swarm_info_esr_url']);
            });

            it('should default to infura', function (done) {
                if (launchDaemon(['-c', DAEMON_OBJ.config_name]).stdout.includes('Connecting to: ropsten.infura.io...')) {
                    done();
                }
            });

        });

        context('should be configurable with swarm_info_esr_url', function () {

            beforeEach('edit config file', function () {
                editConfigFile(DAEMON_OBJ, [['swarm_info_esr_url', 'http://127.0.0.1:8545']]);
            });

            it('should connect to passed address', function (done) {
                if (launchDaemon(['-c', DAEMON_OBJ.config_name]).stdout.includes('Connecting to: 127.0.0.1...')) {
                    done();
                }
            });

            it('should not attempt to connect to infura', function (done) {
                setTimeout(done, 3000);
                if (launchDaemon(['-c', DAEMON_OBJ.config_name]).stdout.includes('Connecting to: ropsten.infura.io...')) {
                    throw new Error('Attempted to connect to infura');
                }
            });
        });
    });
});

function launchDaemon(swarmExecutableArguments) {
    const argumentsArray = Array.isArray(swarmExecutableArguments) ? swarmExecutableArguments : [swarmExecutableArguments];
    return execa.sync('./swarm', argumentsArray, {cwd: getDaemonOutputDir(DAEMON_OBJ.swarm_id, DAEMON_OBJ), reject: false});
};
