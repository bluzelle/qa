
const initializeClient = async ({log = false, logDetailed = false, createDB, ethereum_rpc = harnessConfigs.ethereumRpc, esrContractAddress, private_pem = harnessConfigs.masterPrivateKey, public_pem = harnessConfigs.masterPublicKey, uuid = Math.random().toString()}) => {

    const apis = await bluzelle({
        uuid,
        ethereum_rpc,
        contract_address: esrContractAddress,
        private_pem,
        public_pem,
        _connect_to_all: true,
        log,
        logDetailed,
        onclose: () => console.log('onclose callback')
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
