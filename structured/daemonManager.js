const {times, invoke, pipe, curry, pick} = require('lodash/fp');
const {writeDaemonFile, writeJsonFile} = require('./FileService');

const writeSwarmConfig = ({numberOfDaemons}) => {
    const assignListenerPort = counter({start: 50000});
    const assignHttpPort = counter({start: 8000});

    const daemons = times(() => writeDaemonConfigObject({
        listener_port: assignListenerPort(),
            http_port: assignHttpPort()
    }), numberOfDaemons);
    console.log('****', daemons);
};

const writeDaemonConfig = (config) =>
    writeDaemonConfigObject(config);


const writeDaemonConfigObject = (config) => {
    daemonConfigTemplate()
        .map(createDaemonConfigObject(pick(['listener_port', 'http_port'], config)))
        .flatMap(writeDaemonFile(config, `bluzelle-${config.listener_port}.json`))
        .run();
    return config;
};

const createDaemonConfigObject = curry(({listener_port, http_port}, template) => ({
    ...template,
    listener_port,
    http_port
}));





const counter = ({start, step = 1}) => {
    let count = start - 1;
    return () => count += step
};


setTimeout(() => writeSwarmConfig({numberOfDaemons: 3}));




