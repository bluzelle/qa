const {wrappedError} = require('../src/utils');

const initializeClient = async ({createDB, uuid = harnessConfigs.defaultUuid, ethereum_rpc = harnessConfigs.ethereumRpc, esrContractAddress = harnessConfigs.esrContractAddress, private_pem = harnessConfigs.masterPrivateKey, public_pem = harnessConfigs.masterPublicKey, log = false, logDetailed = false} = {}) => {

    let apis;

    try {
        apis = await bluzelle({
            _connect_to_all: true,

            uuid,
            ethereum_rpc,
            contract_address: esrContractAddress,
            private_pem,
            public_pem,
            log,
            logDetailed
        });
    } catch (err) {
        throw wrappedError(err, 'Client initialization failed');
    }

    if (createDB) {
        try {
            await apis[0]._createDB().timeout(harnessConfigs.clientOperationTimeout);
        } catch (err) {
            throw wrappedError(err, 'Client initialization createDB failed');

        }
    }

    return apis;
};

const createKeys = async (clientObj, numOfKeys, base = 'batch', value = 'value') => {

    const keys = [...Array(numOfKeys).fill(base).map(concatenateValueWithIndex)];

    await keys.reduce((p, key) =>
            p.then(() => clientObj.api.create(key, value))
        , Promise.resolve());

    return {keys, value};
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

const concatenateValueWithIndex = (v, i) => v + i;

module.exports = {
    initializeClient,
    createKeys,
    queryPrimary
};
