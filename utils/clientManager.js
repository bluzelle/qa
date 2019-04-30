
const initializeClient = async ({log, setupDB, uuid = harnessConfigs.clientUuid, pem = harnessConfigs.clientPem} = {}) => {

    const api = bluzelle({
        entry: `ws://${harnessConfigs.address}:${harnessConfigs.port}`,
        uuid: uuid,
        private_pem: pem,
        log: log,
        p2p_latency_bound: 100
    });

    if (setupDB) {
        try {
            await api.createDB();
        } catch (err) {
            console.log('Failed to createDB()')
        }
    }

    return api;
};

const createKeys = async (clientObj, numOfKeys = 10, base = 'batch', start = 0) => {
    for (let j = start; j < numOfKeys; j ++) {
        await clientObj.api.create(`${base}${j}`, 'value')
    }
};

const queryPrimary = async (clientObj) => JSON.parse((await clientObj.api.status()).moduleStatusJson).module[0].status.primary;

module.exports = {
    initializeClient,
    createKeys,
    queryPrimary
};
