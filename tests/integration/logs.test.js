const {swarmManager} = require('../../src/swarmManager');
const {editConfigFile} = require('../../src/utils');
const {spawn} = require('child_process');
const {initializeClient, createKeys} = require('../../src/clientManager');
const {readDaemonDirectory, getDaemonOutputDir, readDaemonFileSize} = require('../../src/FileService');
const {stopSwarmsAndRemoveStateHook} = require('../shared/hooks');
const {harnessConfigs} = require('../../resources/harness-configurations');


describe('logging', function () {

    const DAEMON_OBJ = {
        listener_port: 50000,
        swarm_id: 'swarm0',
        directory_name: 'daemon-50000',
        config_name: 'bluzelle-50000.json'
    };

    context('', function () {

        beforeEach('generate swarm', async function () {
            this.swarmManager = await swarmManager();
            this.swarm = await this.swarmManager.generateSwarm({numberOfDaemons: 1});
        });

        stopSwarmsAndRemoveStateHook({afterHook: afterEach, preserveSwarmState: false});

        context('with log_to_stdout: true', function () {

            beforeEach('edit config file and start daemon', async function () {
                editConfigFile(DAEMON_OBJ, [['log_to_stdout', true]]);
                await this.swarm.start();
            });

            it('should output to stdout', async function () {
                await new Promise(res => {
                    this.swarm.getDaemons()[0].getProcess().stdout.on('data', () => {
                        res()
                    })
                });

            });
        });

        context('with log_to_stdout: false', function () {

            beforeEach('edit config file and start daemon', async function () {
                editConfigFile(DAEMON_OBJ, [['log_to_stdout', false]]);

                // manually spawn daemon because swarm.start() depends on stdout
                await new Promise(res => {
                    this.daemon = spawn('./swarm', ['-c', DAEMON_OBJ.config_name], {cwd: getDaemonOutputDir(DAEMON_OBJ.swarm_id, DAEMON_OBJ)});
                    setTimeout(res, 2000);
                });
            });

            afterEach('stop daemon', function () {
                this.daemon.kill()
            });

            it('should not output to stdout', async function () {

                await new Promise((res, rej) => {
                    this.daemon.stdout.on('data', () => {
                        rej(new Error('Unexpected daemon stdout output'));
                    });

                    setTimeout(res, 2000);
                });

            });
        });

        context('logs path and name is customizable', function () {

            beforeEach('edit config file and start daemon', async function () {
                editConfigFile(DAEMON_OBJ, [['logfile_dir', 'newlogsdir/']]);
                await this.swarm.start();
            });

            it('should create custom logs dir', function () {
                readDaemonDirectory(DAEMON_OBJ.swarm_id, DAEMON_OBJ.directory_name).run().should.include('newlogsdir');
            });

            it('should create log in custom logs dir', function () {
                readDaemonDirectory(DAEMON_OBJ.swarm_id, `${DAEMON_OBJ.directory_name}/newlogsdir`).run()[0].match(/\.log/).should.not.be.null;
            });
        });

    });

    context('log sizes', function () {

        beforeEach('edit config file, start daemon, create keys', async function () {
            this.timeout(harnessConfigs.defaultBeforeHookTimeout + harnessConfigs.keyCreationTimeoutMultiplier * 50);

            this.swarmManager = await swarmManager();
            this.swarm = await this.swarmManager.generateSwarm({numberOfDaemons: 3});

            editConfigFile(DAEMON_OBJ, [['logfile_rotation_size', '2K'], ['logfile_max_size', '10K']]);

            await this.swarmManager.startAll();

            const apis = await initializeClient({
                esrContractAddress: this.swarmManager.getEsrContractAddress(),
                createDB: true
            });

            this.api = apis[0];

            await createKeys({api: this.api}, 50);

        });

        stopSwarmsAndRemoveStateHook({afterHook: afterEach, preserveSwarmState: false});

        it('should not have files over set limit', function () {
            const sizes = readDaemonDirectoryFileSizes(DAEMON_OBJ);

            // maximum are approximates, boost allows large writes to complete
            sizes.should.all.be.below(2100);
        });

        it('dir should not total over set limit', function () {
            const sizes = readDaemonDirectoryFileSizes(DAEMON_OBJ);
            const totalDirectorySize = sizes.reduce((sum, val) => sum += val, 0);

            // maximum is approximate, boost allows large writes to complete
            totalDirectorySize.should.be.below(12000);
        })
    });
});

function readDaemonDirectoryFileSizes(daemonObj) {
    const logFiles = readDaemonDirectory(daemonObj.swarm_id, `${daemonObj.directory_name}/logs`).run();
    const sizes = logFiles.map(logFile => readDaemonFileSize(daemonObj.swarm_id, daemonObj, '/logs', logFile).run()['size']);

    return sizes;
};
