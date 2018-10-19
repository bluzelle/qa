const {expect} = require('chai');
const {exec, execSync, spawn} = require('child_process');
const {includes} = require('lodash');
const waitUntil = require("async-wait-until");

const {despawnSwarm, clearDaemonState, deleteConfigs} = require('../utils/daemon/setup');
const {editFile, generateSwarmConfigsAndSetState, resetHarnessState} = require('../utils/daemon/configs');
const {readDir} = require('../utils/daemon/logs');

describe('daemon', () => {

    beforeEach('clear daemon state state', clearDaemonState);

    beforeEach('generate configs and set harness state', async () =>
        await generateSwarmConfigsAndSetState(1));

    afterEach('remove configs and peerslist and clear harness state', () => {
        deleteConfigs();
        resetHarnessState();
    });

    after(() => {
        execSync('cd ./daemon-build/output/; rm -rf newlogsdir')
    });

    describe('on startup', () => {

        context('with log_to_stdout: true', () => {

            let node;

            beforeEach('edit config file', () => {
                editFile({
                    filename: 'bluzelle0.json',
                    changes: {log_to_stdout: true, logfile_rotation_size: '2K', logfile_max_size: '10K', logfile_dir: 'newlogsdir/'}
                });
            });

            beforeEach('start daemon', () => {
                // https://stackoverflow.com/questions/11337041/force-line-buffering-of-stdout-when-piping-to-tee/11349234#11349234
                // force daemon stdout to output more frequently
                node = spawn('script', ['-q' ,'/dev/null', './run-daemon.sh', 'bluzelle0.json'], {cwd: './scripts'});
            });

            afterEach('kill daemons', despawnSwarm);

            it('should create a log', async () => {

                await waitUntil(() => includes(readDir('output/newlogsdir')[0], '.log'));

                const logs = readDir('output/newlogsdir/');

                expect(logs[0]).to.have.string('.log')
            });

            it('should output to stdout', async () => {

                await new Promise(resolve => {

                    node.stdout.on('data', data => {

                        if (data.toString().includes('RAFT State: Candidate')) {
                            resolve()
                        }
                    });
                });
            });

            it('should be able to change logs dir path and name', async () => {

                await waitUntil(() => readDir('output/').includes('newlogsdir'));

                expect(readDir('output/').includes('newlogsdir')).to.be.true;

            });
        });

        context('with log_to_stdout: false', () => {

            let node;

            beforeEach('edit config file', () => {
                editFile({
                    filename: 'bluzelle0.json',
                    changes: {log_to_stdout: false, logfile_rotation_size: '2K', logfile_max_size: '10K', logfile_dir: 'newlogsdir/'}
                });
            });

            beforeEach('start daemon', () => {
                node = spawn('script', ['-q' ,'/dev/null', './run-daemon.sh', 'bluzelle0.json'], {cwd: './scripts'});
            });

            afterEach('kill daemons', despawnSwarm);

            it('should create a log', async () => {

                await waitUntil(() => includes(readDir('output/newlogsdir')[0], '.log'));

                const logs = readDir('output/newlogsdir/');

                expect(logs[0]).to.have.string('.log')
            });

            it('should not output to stdout', async () => {
                await new Promise(resolve => {

                    let chunk = 0;

                    node.stdout.on('data', data => {
                        chunk += 1;
                    });

                    setTimeout(() => {
                        if (chunk === 1) {
                            resolve()
                        }
                    }, 2000)
                });
                
            });
        });

        context('log sizes', () => {
           it('should not have files over set limit', (done) => {
               exec("cd ./daemon-build/output/newlogsdir; ls -l | awk '{print $5}' ", (error, stdout, stderr) => {

                   const sizes = stdout.trim().split('\n').map(Number);

                   // maximum are approximates, boost allows large writes to complete
                   if (sizes.every(size => size < 2100)) {
                       done()
                   }
               });
           });

           it('dir should not total over set limit', done => {
               exec("cd ./daemon-build/output/newlogsdir; ls -l | awk '{print $5}' ", (error, stdout, stderr) => {

                   const sizes = stdout.trim().split('\n').map(Number);

                   // maximum are approximates, boost allows large writes to complete
                   if (sizes.reduce((total, num) => total + num) < 11000) {
                       done()
                   }
               });
           })
        });
    });
});

