
const initializeClient = async ({address = harnessConfigs.address, port = harnessConfigs.port, log, setupDB, pem = harnessConfigs.masterPrivateKey} = {}) => {

    const api = await bluzelle({
        entry: `ws://${address}:${port}`,
        ethereum_rpc: harnessConfigs.ethereumRpc,
        contract_address: harnessConfigs.esrContractAddress,
        private_pem: pem,
        _connect_to_all: true,
        log: false,
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
