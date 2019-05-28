// load env variables from qa/.env if it exists
require('dotenv').config();

global.bluzelle = require('../bluzelle-js/lib/bluzelle-node').bluzelle;

global.chai = require('chai');
global.expect = chai.expect;
chai.use(require('chai-as-promised'));
chai.use(require('chai-json-schema'));
chai.use(require('chai-things'));
chai.should();

global.harnessConfigs = {
    address: process.env.ADDRESS ? process.env.ADDRESS : 'localhost',
    port: process.env.PORT ? parseInt(process.env.PORT) : 50000,
    numOfNodes: process.env.NUM_OF_NODES ? parseInt(process.env.NUM_OF_NODES) : 4,
    testRemoteSwarm: process.env.TEST_REMOTE_SWARM ? process.env.TEST_REMOTE_SWARM : false,

    masterPrivateKey: 'MHQCAQEEIEOd7E9zSxgJjtpGzK/gHl0vVSOZ2iF3TY50InD67BnHoAcGBSuBBAAKoUQDQgAEE/Yeq9sYdyeou+TnNEJjMnuntrzqcFIfIHd49LW461d55TY4hVX66ZXXGvAWRqMVMeELtYuKGYU44bPaxTb1ig==',
    masterPublicKey: 'MFYwEAYHKoZIzj0CAQYFK4EEAAoDQgAEE/Yeq9sYdyeou+TnNEJjMnuntrzqcFIfIHd49LW461d55TY4hVX66ZXXGvAWRqMVMeELtYuKGYU44bPaxTb1ig==',

    ethereumRpc: process.env.ETHEREUM_RPC ? process.env.ETHEREUM_RPC : 'http://127.0.0.1:8545',
    esrContractAddress: process.env.ESR_CONTRACT_ADDRESS ? process.env.ESR_CONTRACT_ADDRESS : '0x7FDbE549D8b47b8285ff106E060Eb9C43Fd879e5',

    initialDaemonListenerPort: 50000,
    initialDaemonHttpPort: 8080,

    daemonStartTimeout: 3000,
    keyCreationTimeoutMultiplier: 500, // time allotted per key created in before hooks of dynamically generated tests
    defaultTestTimeout: 5000,
    defaultBeforeHookTimeout: 15000,
    clientOperationTimeout: 5000
};
