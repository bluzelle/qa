const {startSwarm, initializeClient, teardown} = require('../utils/daemon/setup');
const assert = require('assert');

let clientsObj = {};
let swarm;
let numOfNodes = 3;

describe('status', () => {

    beforeEach('stand up swarm and client', async function () {
        this.timeout(30000);
        swarm = await startSwarm({numOfNodes});
        clientsObj.api = await initializeClient({swarm, setupDB: true});
    });

    afterEach('remove configs and peerslist and clear harness state', function () {
        teardown.call(this.currentTest, process.env.DEBUG_FAILS);
    });

    it('should be able to get status', async () => {
        const res = await clientsObj.api.status();

        assert(res.swarmVersion);
        assert(res.swarmGitCommit);
        assert(res.uptime);
        assert(res.moduleStatusJson);

        const parsedStatusJson = JSON.parse(res.moduleStatusJson).module[0].status;

        assert(parsedStatusJson.is_primary);
        assert(parsedStatusJson.latest_checkpoint);
        assert(parsedStatusJson.next_issued_sequence_number >= 1);
        assert(parsedStatusJson.outstanding_operations_count >= 1);
        assert(parsedStatusJson.peer_index.length >= 2);
        assert(parsedStatusJson.primary.host);
        assert(parsedStatusJson.primary.host_port);
        assert(parsedStatusJson.primary.http_port);
        assert(parsedStatusJson.primary.name);
        assert(parsedStatusJson.primary.uuid);
        assert(parsedStatusJson.unstable_checkpoints_count >= 0);
        assert(parsedStatusJson.view >= 1);
    });
});
