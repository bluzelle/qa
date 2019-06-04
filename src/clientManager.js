
const initializeClient = async ({log = false, createDB, ethereum_rpc = harnessConfigs.ethereumRpc, esrContractAddress, private_pem = harnessConfigs.masterPrivateKey, public_pem = harnessConfigs.masterPublicKey}) => {

    const apis = await bluzelle({
        uuid: Math.random().toString(),
        ethereum_rpc: ethereum_rpc,
        contract_address: esrContractAddress,
        private_pem: private_pem,
        public_pem: public_pem,
        _connect_to_all: true,
        log: log,
        logDetailed: false
    });

    if (createDB) {
        try {
            await apis[0].createDB();
        } catch (err) {
            console.log('Failed to createDB()')
        }
    }

    return apis;
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
