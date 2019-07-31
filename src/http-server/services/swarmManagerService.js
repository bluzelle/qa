const {swarmManager} = require('../../swarmManager');
const {OperationError} = require('../errors');

let manager;

exports.initialize = async function () {
    manager = await swarmManager()
        .catch(err => {
            const error = new OperationError('Problem initializing swarmManager');
            error.stack += '\n' + err.stack;
            throw error;
        });

    console.log(`Deployed ESR Contract Address: ${manager.getEsrContractAddress()}`);
};

exports.get = function () {
    if (manager !== undefined) {
        return manager
    }
};
