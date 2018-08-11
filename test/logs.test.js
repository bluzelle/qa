const {expect} = require('chai');
const {exec, spawn} = require('child_process');
const {includes} = require('lodash');
const waitUntil = require("async-wait-until");

const {killSwarm} = require('../utils/daemon/setup');
const {editFile} = require('../utils/daemon/configs');
const {readDir} = require('../utils/daemon/logs');

describe.only('daemon', () => {

    after(() => {
        exec('cd ./daemon-build/output/; rm -rf newlogsdir')
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
                node = spawn('./run-daemon.sh', ['bluzelle0.json'], {cwd: './scripts'});
            });

            afterEach('kill daemons', killSwarm);

            it('should create a log', async () => {

                await waitUntil(() => includes(readDir('output/newlogsdir')[0], '.log'));

                const logs = readDir('output/newlogsdir/');

                expect(logs[0]).to.have.string('.log')
            });

            it.skip('should output to stdout', async () => {
                await new Promise(resolve => {

                    node.stdout.on('data', data => {

                        if (data.toString().includes('RAFT State: Candidate')) {
                            resolve()
                        }
                    });
                });
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
                node = spawn('./run-daemon.sh', ['bluzelle0.json'], {cwd: './scripts'});
            });

            afterEach('kill daemons', killSwarm);

            it('should create a log', async () => {

                await waitUntil(() => includes(readDir('output/newlogsdir')[0], '.log'));

                const logs = readDir('output/newlogsdir/');

                expect(logs[0]).to.have.string('.log')
            });

            it.skip('should not output to stdout', async () => {
                
            });
        });

        context('log sizes', () => {
           it('should not have files over 2KB', (done) => {
               exec("cd ./daemon-build/output/newlogsdir; ls -l | awk '{print $5}' ", (error, stdout, stderr) => {

                   const sizes = stdout.trim().split('\n').map(Number);

                   // maximum are approximates, boost allows large writes to complete
                   if (sizes.every(size => size < 2100)) {
                       done()
                   }
               });
           });

           it('dir should not total over 10KB', done => {
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

