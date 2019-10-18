const {invoke} = require('lodash/fp');
const {removeDaemonDirectory} = require('./FileService');
const {generateSwarm} = require('./daemonManager');
const {counter, useState} = require('./utils');
const swarmRegistry = require('./swarmRegistryAdapter');
const {log} = require('./logger');

exports.swarmManager = async () => {
    const [getSwarms, setSwarms] = useState([]);
    const [getEsrContractAddress, setEsrContractAddress] = useState();
    const daemonCounter = counter({start: 0});
    const swarmCounter = counter({start: 0});

    const esrInstance = await swarmRegistry.deploy();
    setEsrContractAddress(esrInstance.address);

    log.info(`Deployed local ESR Contract Address: ${esrInstance.address}`);

    return {
        generateSwarm: generateSwarmAndSetState,
        getEsrContractAddress,
        getSwarms,
        startAll: () => executeAll('start'),
        stopAll: () => executeAll('stop'),
        removeSwarmState: () => removeDaemonDirectory().run(),
        disconnectEsr: swarmRegistry.disconnect
    };

    async function generateSwarmAndSetState({numberOfDaemons, configOptions}) {
        const swarm = await generateSwarm({esrContractAddress: getEsrContractAddress(), esrInstance, numberOfDaemons, swarmCounter, daemonCounter, configOptions});
        setSwarms([...getSwarms(), swarm]);

        return swarm;
    };

    function executeAll(cmd) {
        return Promise.all(getSwarms().map(invoke(cmd)));
    }
};
