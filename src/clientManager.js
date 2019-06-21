const {wrappedError} = require('../src/utils');

const initializeClient = async ({log = false, logDetailed = false, createDB, ethereum_rpc = harnessConfigs.ethereumRpc, esrContractAddress, private_pem = harnessConfigs.masterPrivateKey, public_pem = harnessConfigs.masterPublicKey, uuid = harnessConfigs.uuid}) => {

    let apis;

    try {
        apis = await bluzelle({
            uuid,
            ethereum_rpc,
            contract_address: esrContractAddress,
            private_pem,
            public_pem,
            _connect_to_all: true,
            log,
            logDetailed
        });
    } catch (err) {
        throw wrappedError(err, 'Client initialization failed');
    }

    if (createDB) {
        try {
            await apis[0].createDB().timeout(harnessConfigs.clientOperationTimeout);
        } catch (err) {
            throw wrappedError(err, 'Client initialization createDB failed');

        }
    }

    return apis;
};

const createKeys = async (clientObj, numOfKeys = 10, base = 'batch', start = 0) => {
    for (let j = start; j < numOfKeys; j++) {
        await clientObj.api.create(`${base}${j}`, 'value')
    }
};

const queryPrimary = async (clientObj) => {

    let statusResponse;

    try {
        statusResponse = await clientObj.api.status().timeout(harnessConfigs.clientOperationTimeout)
    } catch (err) {
        throw wrappedError(err, 'queryPrimary status request failed');
    }

    try {
        return (JSON.parse(statusResponse.moduleStatusJson)).module[0].status.primary
    } catch (err) {
        throw wrappedError(err, 'Failed to parse status response JSON');
    }
};

module.exports = {
    initializeClient,
    createKeys,
    queryPrimary
};
