const {startSwarm, initializeClient, teardown} = require('../utils/daemon/setup');
const chai = require('chai');
const expect = chai.expect;
chai.use(require('chai-json-schema'));


const numOfNodes = harnessConfigs.numOfNodes;

describe('status', () => {

    before('stand up swarm and client', async function () {
        this.timeout(30000);
        [this.swarm] = await startSwarm({numOfNodes});
        this.api = await initializeClient({swarm: this.swarm, setupDB: true});
    });

    after('remove configs and peerslist and clear harness state', function () {
        teardown.call(this.currentTest, process.env.DEBUG_FAILS);
    });

    it('should be able to get status', async function () {
        await this.api.status();
    });

    it('response should confirm to schema', async function () {

        const res = await this.api.status();

        expect(res).to.be.jsonSchema(statusSchema);

        const moduleStatusJson = JSON.parse(res.moduleStatusJson).module[0].status;

        expect(moduleStatusJson).to.be.jsonSchema(moduleStatusJsonSchema);
    });
});

const statusSchema = {
    properties: {
        swarmVersion: {
            type: 'string'
        },
        swarmGitCommit: {
            type: 'string'
        },
        uptime: {
            type: 'string'
        },
        moduleStatusJson: {
            type: 'string'
        }
    }
};

const moduleStatusJsonSchema = {
    properties: {
        is_primary: {
            type: 'boolean'
        },
        latest_checkpoint: {
            properties: {
                hash: {
                    type: 'string'
                },
                sequence_number: {
                    type: 'number'
                }
            }
        },
        next_issued_sequence_number: {
            type: 'number',
            minimum: 0
        },
        outstanding_operations_count: {
            type: 'number',
            minimum: 0
        },
        peer_index: {
            type: 'array',
            minimum: 2
        },
        primary: {
            properties: {
                host: {
                    type: 'string'
                },
                host_port: {
                    type: 'number'
                },
                uuid: {
                    type: 'string'
                }
            }
        },
        unstable_checkpoints_count: {
            type: 'number',
            minimum: 0
        },
        view: {
            type: 'number',
            minimum: 0
        }
    }
};
