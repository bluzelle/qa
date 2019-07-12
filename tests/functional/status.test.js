const {remoteSwarmHook, localSwarmHooks} = require('../shared/hooks');
const {initializeClient} = require('../../src/clientManager');


(harnessConfigs.testRemoteSwarm ? describe.only : describe)('status', function () {

    const testParams = {
        numberOfNamespaces: 3,
        namespaceSize: 5000,
        maxSwarmStorage: 20000
    };

    (harnessConfigs.testRemoteSwarm ? remoteSwarmHook() : localSwarmHooks({configOptions: {max_swarm_storage: testParams.maxSwarmStorage}}));

    before('make status request', async function () {
        this.response = await this.api.status();

        this.moduleStatusJson = JSON.parse(this.response.moduleStatusJson)
    });

    it('status response should conform to status schema', async function () {
        expect(this.response).to.be.jsonSchema(statusSchema);
    });

    it('moduleStatusJson[0] response should conform to status schema', async function () {
        expect(this.moduleStatusJson.module[0]).to.be.jsonSchema(pbftModuleSchema);
    });

    it('moduleStatusJson[1] response should conform to crud schema', async  function () {
        expect(this.moduleStatusJson.module[1]).to.be.jsonSchema(crudModuleSchema);
    });

    context('crud module', function () {

        before('create name spaces', async function () {
            const uuids = [...Array(testParams.numberOfNamespaces)].map(() => `${Math.random()}`);
            const clients = await Promise.all(uuids.map(uuid => initializeClient({uuid, esrContractAddress: this.swarmManager.getEsrContractAddress()})));
            await Promise.all(clients.map(apis => apis[0]._createDB(testParams.namespaceSize)));
        });

        it('should report correct swarm_storage_usage', async function () {
            const res = await this.api.status();

            expect(JSON.parse(res.moduleStatusJson).module[1].status).to.deep.include({'swarm_storage_usage': testParams.namespaceSize * testParams.numberOfNamespaces})
        });

        if (!harnessConfigs.testRemoteSwarm) {
            it('should report correct swarm_storage_usage', async function () {
                const res = await this.api.status();

                expect(JSON.parse(res.moduleStatusJson).module[1].status).to.deep.include({'max_swarm_storage': testParams.maxSwarmStorage})
            });
        }
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
        swarmId: {
            type: 'string'
        },
        uptime: {
            type: 'string'
        },
        moduleStatusJson: {
            type: 'string'
        },
        pbftEnabled: {
            type: 'boolean'
        }
    },
    required: [
        'swarmVersion',
        'swarmGitCommit',
        'swarmId',
        'uptime',
        'moduleStatusJson',
        'pbftEnabled'
    ],
    additionalProperties: false
};

const pbftModuleSchema = {
    properties: {
        name: {
            type: 'string'
        },
        status: {
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
                latest_stable_checkpoint: {
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
                    },
                    required: [
                        'host',
                        'host_port',
                        'uuid'
                    ]
                },
                view: {
                    type: 'number',
                    minimum: 0
                }
            },
            required: [
                'is_primary',
                'latest_checkpoint',
                'latest_stable_checkpoint',
                'next_issued_sequence_number',
                'outstanding_operations_count',
                'peer_index',
                'primary',
                'view'
            ],
            additionalProperties: false
        }
    },
    required: ['name', 'status']
};

const crudModuleSchema = {
    properties: {
        name: {
            type: 'string'
        },
        status: {
            properties: {
                max_swarm_storage: {
                    type: 'integer'
                },
                swarm_storage_usage: {
                    type: 'integer'
                }
            },
            required: ['max_swarm_storage', 'swarm_storage_usage']
        }

    },
    required: ['name', 'status'],
    additionalProperties: false
};
