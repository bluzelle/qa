const {spawn} = require('child_process');
const {initializeClient, createKeys} = require('../../src/clientManager');
const {readDaemonFile, writeDaemonFile, readDaemonDirectory, getDaemonOutputDir, readDaemonFileSize} = require('../../src/FileService');
const {generateSwarm} = require('../../src/daemonManager');


describe('logging', function () {

    const DAEMON_OBJ = {
        listener_port: 50000,
        directory_name: 'daemon-50000',
        config_name: 'bluzelle-50000.json'
    };

    beforeEach('generate configs and set harness state', async function () {
        this.swarm = generateSwarm({numberOfDaemons: 1});
    });

    afterEach('remove configs and peerslist and clear harness state', async function () {
        await this.swarm.stop();
        this.swarm.removeSwarmState();
    });

    context('with log_to_stdout: true', function () {

        beforeEach('edit config file', function () {
            const configFile = readDaemonFile(DAEMON_OBJ, DAEMON_OBJ.config_name).run();

            configFile.log_to_stdout = true;

            writeDaemonFile(DAEMON_OBJ, DAEMON_OBJ.config_name, configFile).run();
        });

        beforeEach('start daemon', async function () {
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

        beforeEach('edit config file', function () {
            const configFile = readDaemonFile(DAEMON_OBJ, DAEMON_OBJ.config_name).run();

            configFile.log_to_stdout = false;

            writeDaemonFile(DAEMON_OBJ, DAEMON_OBJ.config_name, configFile).run();
        });

        beforeEach('start daemon', async function () {
            // manually spawn daemon because swarm.start() depends on stdout
            await new Promise(res => {
                this.daemon = spawn('./swarm', ['-c', DAEMON_OBJ.config_name], {cwd: getDaemonOutputDir(DAEMON_OBJ)});
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

        beforeEach('edit config file', function () {
            const configFile = readDaemonFile(DAEMON_OBJ, DAEMON_OBJ.config_name).run();

            configFile.logfile_dir = 'newlogsdir/';

            writeDaemonFile(DAEMON_OBJ, DAEMON_OBJ.config_name, configFile).run();
        });

        beforeEach('start daemon', async function () {
            await this.swarm.start();
        });

        it('should create custom logs dir', function () {
            readDaemonDirectory(DAEMON_OBJ.directory_name).run().should.include('newlogsdir');
        });

        it('should create log in custom logs dir', function () {
            readDaemonDirectory(`${DAEMON_OBJ.directory_name}/newlogsdir`).run()[0].match(/\.log/).should.not.be.null;
        });
    });


    context('log sizes', function () {

        beforeEach('edit config file', function () {
            const configFile = readDaemonFile(DAEMON_OBJ, DAEMON_OBJ.config_name).run();

            configFile.logfile_rotation_size = '2K';
            configFile.logfile_max_size = '10K';

            writeDaemonFile(DAEMON_OBJ, DAEMON_OBJ.config_name, configFile).run();
        });

        beforeEach('start daemon, initialize client, and create keys', async function () {
            await this.swarm.start();
            this.api = await initializeClient({setupDB: true, log: false});
            await createKeys({api: this.api}, 50);
        });

        it('should not have files over set limit', function () {
            const logFiles = readDaemonDirectory(`${DAEMON_OBJ.directory_name}/logs`).run();
            const sizes = logFiles.map(logFile => readDaemonFileSize(DAEMON_OBJ, '/logs', logFile).run()['size']);

            // maximum are approximates, boost allows large writes to complete
            sizes.should.all.be.below(2100);
        });

        it('dir should not total over set limit', function () {
            const logFiles = readDaemonDirectory(`${DAEMON_OBJ.directory_name}/logs`).run();
            const sizes = logFiles.map(logFile => readDaemonFileSize(DAEMON_OBJ, '/logs', logFile).run()['size']);
            const totalDirectorySize = sizes.reduce((sum, val) => sum += val, 0);

            // maximum is approximate, boost allows large writes to complete
            totalDirectorySize.should.be.below(12000);
        })
    });
});

