const {invoke} = require('lodash/fp');
const {removeDaemonDirectory} = require('./FileService');
const {generateSwarm} = require('./daemonManager');
const {counter, useState} = require('./utils');
const swarmRegistry = require('./swarmRegistryAdapter');

exports.swarmManager = async () => {
    const [getSwarms, setSwarms] = useState([]);
    const daemonCounter = counter({start: 0});
    const swarmCounter = counter({start: 0});

    const esrInstance = await swarmRegistry.deploy();

    return {
        generateSwarm: generateSwarmAndSetState,
        getSwarms,
        startAll: () => executeAll('start'),
        stopAll: () => executeAll('stop'),
        removeSwarmState: () => removeDaemonDirectory().run(),
    };

    async function generateSwarmAndSetState({numberOfDaemons}) {
        const swarm = await generateSwarm({esrInstance, numberOfDaemons, swarmCounter, daemonCounter});
        setSwarms([...getSwarms(), swarm]);

        return swarm;
    };

    function executeAll(cmd) {
        return Promise.all(getSwarms().map(invoke(cmd)));
    }
};
