const waitUntil = require("async-wait-until");
const expect = require('chai').expect;
const {exec, execSync, spawn} = require('child_process');
const fs = require('fs');

const {spawnSwarm, despawnSwarm, swarm} = require('../utils/daemon/setup');
const {editFile} = require('../utils/daemon/configs');
const api = require('../bluzelle-js/lib/bluzelle.node');
const shared = require('./shared');


describe('raft', () => {

    context('swarm', () => {

        it('should elect a leader', () => {
        });

        context('followers die', () => {

            context('reconnecting', () => {

                beforeEach('add node to peerlist', () => {
                    let fileContent = JSON.parse(fs.readFileSync(`./daemon-build/output/peers.json`, 'utf8'));

                    fileContent[3] = {
                        "name": "peer4",
                        "host": "127.0.0.1",
                        "port": 50003,
                        "uuid": "3dd73906-3315-4991-b53d-81ffdf77360c",
                        "http_port": 8083
                    };

                    fs.writeFileSync(`./daemon-build/output/peers.json`, JSON.stringify(fileContent), 'utf8');
                });

                beforeEach('spawn swarm and elect leader', spawnSwarm);

                afterEach('despawn swarm', despawnSwarm);

                beforeEach(() => {

                    execSync('cp -R ./configs/bluzelle2.json ./daemon-build/output/bluzelle3.json')

                    editFile({
                        filename: 'bluzelle3.json',
                        changes: {
                            listener_port: 50003,
                            uuid: "3dd73906-3315-4991-b53d-81ffdf77360c",
                            http_port: 8083
                        }
                    });
                });

                context('with no .dat file', () => {

                    it('should sync', done => {

                        const node = spawn('./run-daemon.sh', ['bluzelle3.json'], {cwd: './scripts'});

                        node.stdout.on('data', data => {

                            if (data.toString().includes('current term out of sync:')) {
                                done();
                            }
                        });
                    });
                });

                context('with consistent but outdated .dat file', () => {

                    beforeEach('start node, create state, kill node, create state', done => {

                        spawn('./run-daemon.sh', ['bluzelle3.json'], {cwd: './scripts'});

                        setTimeout(async () => {

                            await api.connect('ws://127.0.0.1:50003', '71e2cd35-b606-41e6-bb08-f20de30df76c');

                            await api.create('key', '123');

                            execSync(`kill $(ps aux | grep '[b]luzelle3'| awk '{print $2}')`);

                            await api.create('key2', '123');

                            done()

                        }, 500);
                    });

                    it('should sync', done => {

                        const node = spawn('./run-daemon.sh', ['bluzelle3.json'], {cwd: './scripts'});

                        node.stdout.on('data', data => {

                            if (data.toString().includes('Follower inserting entry with message index')) {

                                done();

                            }
                        });
                    });
                });

                context('with inconsistent .dat file', () => {

                    beforeEach('start node, create state, kill node', done => {

                        spawn('./run-daemon.sh', ['bluzelle3.json'], {cwd: './scripts'});

                        setTimeout(async () => {

                            await api.connect('ws://127.0.0.1:50003', '71e2cd35-b606-41e6-bb08-f20de30df76c');

                            await api.create('key', '123');

                            execSync(`kill $(ps aux | grep '[b]luzelle3'| awk '{print $2}')`);

                            done()

                        }, 500);
                    });

                    beforeEach('change index to render .dat file inconsistent', () => {

                        let fileContent = fs.readFileSync(`./daemon-build/output/.state/3dd73906-3315-4991-b53d-81ffdf77360c.dat`, 'utf8');

                        fileContent = fileContent.replace('1 1', '1 10');

                        fs.writeFileSync(`./daemon-build/output/.state/3dd73906-3315-4991-b53d-81ffdf77360c.dat`, fileContent, 'utf8');
                    });

                    it('should reject AppendEntries', done => {

                        const node = spawn('./run-daemon.sh', ['bluzelle3.json'], {cwd: './scripts'});

                        let flag = false;

                        node.stdout.on('data', data => {

                            if (!flag && data.toString().includes('Rejecting AppendEntries because I do not agree with the previous index')) {
                                flag = true;
                                done()
                            }

                        });
                    });
                });
            });

            context('with sufficient nodes for consensus', () => {

                beforeEach('spawn swarm and elect leader', spawnSwarm);

                beforeEach('kill one follower', () => {

                    const daemons = Object.keys(swarm.list);

                    daemons.splice(daemons.indexOf(swarm.leader), 1);

                    const cfgName = `[b]luzelle${daemons[0].split('').pop()}`;

                    execSync(`kill $(ps aux | grep '${cfgName}' | awk '{print $2}')`)
                });

                beforeEach(() => {
                    shared.connect(process.env.address, swarm.list[swarm.leader], '71e2cd35-b606-41e6-bb08-f20de30df76c');
                });

                afterEach('despawn swarm', despawnSwarm);

                shared.swarmIsOperational();
            });

            context('with insufficient nodes for consensus', () => {

                beforeEach('spawn swarm and elect leader', spawnSwarm);

                beforeEach('kill all followers', () => {

                    const daemons = Object.keys(swarm.list);

                    daemons.splice(daemons.indexOf(swarm.leader), 1);

                    daemons.forEach(daemon => {

                        const cfgName = `[b]luzelle${daemon.split('').pop()}`;

                        execSync(`kill $(ps aux | grep '${cfgName}' | awk '{print $2}')`)
                    })
                });

                beforeEach(() => {
                    shared.connect(process.env.address, swarm.list[swarm.leader], '71e2cd35-b606-41e6-bb08-f20de30df76c');
                });

                afterEach('despawn swarm', despawnSwarm);

                shared.createShouldTimeout();
            })
        });

        context('leader dies', () => {

            beforeEach('spawn swarm and elect leader', spawnSwarm);

            afterEach('despawn swarm', despawnSwarm);

            it('should elect a new leader', async () => {

                const killedLeader = swarm.leader;

                const cfgName = `[b]luzelle${swarm.leader.split('').pop()}`;

                execSync(`kill $(ps aux | grep '${cfgName}' | awk '{print $2}')`);

                await waitUntil(() => swarm.leader !== killedLeader, 2000);
            })
        })
    });
});
