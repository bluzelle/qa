const {spawn, exec} = require('child_process');
const waitUntil = require("async-wait-until");
const expect = require('chai').expect;

const api = require('../bluzelle-js/src/api');
const {editConfigFile, resetConfigFile} = require('../utils/daemon/configs');

const swarm = {list: {'daemon0': 50000, 'daemon1': 50001, 'daemon2': 50002}};

const spawnSwarm = async () => {

    exec('cd ./daemon-build/output/; rm -rf .state');

    editConfigFile('bluzelle0.json', 7, '\n  "log_to_stdout" : true \n }');

    Object.keys(swarm.list).forEach((daemon, i) => {

        swarm[daemon] = spawn('./run-daemon.sh', [`bluzelle${i}.json`], {cwd: './scripts'});

        swarm[daemon].stdout.on('data', data => {
            if (data.toString().includes('RAFT State: Leader')) {
                swarm.leader = daemon;
            }
        });

    });

    try {
        await waitUntil(() => swarm.leader, 10000);
    } catch (err) {
        console.log(`Failed to declare leader`)
    }
};

const despawnSwarm = () => {

    resetConfigFile('bluzelle0.json');

    exec('pkill -2 swarm');

    swarm.daemon0, swarm.daemon1, swarm.daemon2, swarm.leader = undefined;
};


describe('raft', () => {

    beforeEach('spawn swarm and elect leader', spawnSwarm);

    beforeEach(() =>
        api.connect(`ws://${process.env.address}:${swarm.list[swarm.leader]}`, '71e2cd35-b606-41e6-bb08-f20de30df76c'));

    afterEach('despawn swarm', despawnSwarm);

    context('swarm', () => {

        it('should elect a leader', () => {
        });

        context('followers die', () => {

            context('with sufficient nodes for consensus', () => {

                beforeEach('kill one follower', () => {
                    const daemons = Object.keys(swarm.list);

                    daemons.splice(daemons.indexOf(swarm.leader), 1);

                    const cfgName = `[b]luzelle${daemons[0].split('').pop()}`;

                    exec(`kill $(ps aux | grep '${cfgName}' | awk '{print $2}')`)
                });

                it('should write successfully', async () => {

                    await api.create('key1', 123);

                    expect(await api.read('key1')).to.equal(123)
                });
            });

            context('with insufficient nodes for consensus', () => {

                beforeEach('kill all followers', () => {
                    const daemons = Object.keys(swarm.list);

                    daemons.splice(daemons.indexOf(swarm.leader), 1);

                    daemons.forEach(daemon => {

                        const cfgName = `[b]luzelle${daemon.split('').pop()}`;

                        exec(`kill $(ps aux | grep '${cfgName}' | awk '{print $2}')`)
                    })
                });

                it('should timeout at api level', done => {

                    api.create('key2', 123).catch(e => {

                        expect(e.toString()).to.include('Error: Bluzelle poll timeout - command not commited to swarm.')

                        done();
                    });
                })
            })
        });

        context('leader dies', () => {

            it('should elect a new leader', async function () {
                this.timeout(15000);

                const killedLeader = swarm.leader;

                const cfgName = `[b]luzelle${swarm.leader.split('').pop()}`;

                exec(`kill $(ps aux | grep '${cfgName}' | awk '{print $2}')`);

                await waitUntil(() => swarm.leader !== killedLeader, 15000);
            })
        })
    });
});
