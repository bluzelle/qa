const waitUntil = require("async-wait-until");
const expect = require('chai').expect;
const {exec} = require('child_process');

const {spawnSwarm, despawnSwarm, swarm} = require('../utils/daemon/setup');
const api = require('../bluzelle-js/src/api');
const shared = require('./shared');


describe('raft', () => {

    beforeEach('spawn swarm and elect leader', spawnSwarm);

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

                beforeEach(() => {
                    shared.connect(process.env.address, swarm.list[swarm.leader], '71e2cd35-b606-41e6-bb08-f20de30df76c');
                });

                shared.swarmIsOperational();
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

                beforeEach(() => {
                    shared.connect(process.env.address, swarm.list[swarm.leader], '71e2cd35-b606-41e6-bb08-f20de30df76c');
                });

                shared.createShouldTimeout();
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
