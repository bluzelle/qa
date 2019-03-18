const {expect} = require('chai');
const {exec, execSync, spawn} = require('child_process');
const {includes} = require('lodash');
const waitUntil = require("async-wait-until");

const {despawnSwarm, clearDaemonState, clearDaemonStateAndConfigs} = require('../../utils/daemon/setup');
const {editFile, generateSwarmJsonsAndSetState} = require('../../utils/daemon/configs');
const {readDir} = require('../../utils/daemon/logs');


describe('logging', () => {

    beforeEach('generate configs and set harness state', async () =>
        await generateSwarmJsonsAndSetState(1));

    after('remove configs and peerslist and clear harness state', () => {
        clearDaemonStateAndConfigs();
    });

    context('with log_to_stdout: true', () => {

        let node;
        let output = '';

        beforeEach('clear daemon state', clearDaemonState);

        beforeEach('edit config file', () => {
            editFile({
                filepath: 'daemon0/bluzelle0.json',
                changes: {
                    log_to_stdout: true,
                    logfile_rotation_size: '2K',
                    logfile_max_size: '10K',
                    logfile_dir: 'newlogsdir/'
                }
            });
        });

        beforeEach('start daemon', () => {
            // https://stackoverflow.com/questions/11337041/force-line-buffering-of-stdout-when-piping-to-tee/11349234#11349234
            // force daemon stdout to output more frequently
            node = spawn('script', ['-q', '/dev/null', './run-daemon.sh', 'bluzelle0.json', 'daemon0'], {cwd: './scripts'});

            node.stdout.on('data', data => {
                output += data.toString();
            });
        });

        afterEach('kill daemons', despawnSwarm);

        it('should create a log', async () => {

            await waitUntil(() => includes(readDir('output/daemon0'), 'newlogsdir'));

            await waitUntil(() => includes(readDir('output/daemon0/newlogsdir')[0], '.log'));

            const logs = readDir('output/daemon0/newlogsdir/');

            expect(logs[0]).to.have.string('.log')
        });

        it('should output to stdout', async () => {

            await waitUntil(() => output.includes('Running node with ID'))
        });

        it('should be able to change logs dir path and name', async () => {

            await waitUntil(() => readDir('output/daemon0').includes('newlogsdir'));

            expect(readDir('output/daemon0').includes('newlogsdir')).to.be.true;

        });
    });

    context('with log_to_stdout: false', () => {

        let node, chunk;

        beforeEach('edit config file', () => {
            editFile({
                filepath: 'daemon0/bluzelle0.json',
                changes: {
                    log_to_stdout: false,
                    logfile_rotation_size: '2K',
                    logfile_max_size: '10K',
                    logfile_dir: 'newlogsdir/'
                }
            });
        });

        beforeEach('start daemon', () => {
            node = spawn('script', ['-q', '/dev/null', './run-daemon.sh', 'bluzelle0.json', 'daemon0'], {cwd: './scripts'});

            chunk = 0;

            node.stdout.on('data', data => {
                chunk += 1;
            });
        });

        afterEach('kill daemons', despawnSwarm);

        it('should create a log', async () => {

            await waitUntil(() => includes(readDir('output/daemon0/newlogsdir')[0], '.log'));

            const logs = readDir('output/daemon0/newlogsdir/');

            expect(logs[0]).to.have.string('.log')
        });

        it('should not output to stdout', async () => {
            await new Promise((resolve, reject) => {

                setTimeout(() => {
                    if (chunk > 0 && chunk <= 2) {
                        resolve()
                    } else {
                        reject(new Error(`Received: ${chunk} chunks of data, expected: 1 `))
                    }
                }, 2000)
            });
        });
    });

    context('log sizes', () => {

        it('should not have files over set limit', (done) => {
            exec("cd ./daemon-build/output/daemon0/newlogsdir; ls -l | awk '{print $5}' ", (error, stdout, stderr) => {

                const sizes = stdout.trim().split('\n').map(Number);

                // maximum are approximates, boost allows large writes to complete
                if (sizes.every(size => size < 2100)) {
                    done()
                } else {
                    throw new Error(`Expected log sizes to be < 2100. Sizes: ${sizes}`)
                }
            });
        });

        it('dir should not total over set limit', done => {
            exec("cd ./daemon-build/output/daemon0/newlogsdir; ls -l | awk '{print $5}' ", (error, stdout, stderr) => {

                const sizes = stdout.trim().split('\n').map(Number);

                // maximum are approximates, boost allows large writes to complete
                const total = sizes.reduce((total, num) => total + num);
                if (total < 11000) {
                    done()
                } else {
                    throw new Error(`Expected directory total to be < 11000. Total: ${total}`)
                }
            });
        })
    });
});

