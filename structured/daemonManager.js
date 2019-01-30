const {times, invoke, pipe, curry, pick} = require('lodash/fp');
const {writeDaemonFile, writeJsonFile, removeDaemonDirectory, getDaemonOuputDir} = require('./FileService');
const {generateKeys} = require('./crypto');
const {IO} = require('monet');

const writeSwarmConfig = ({numberOfDaemons}) => {
    const assignListenerPort = counter({start: 50000});
    const assignHttpPort = counter({start: 8000});

    removeDaemonDirectory().run();

    const daemonConfigs = times(pipe(

        () => writeDaemonConfigObject({
            listener_port: assignListenerPort(),
            http_port: assignHttpPort()
        }),

        daemonConfig => ({
            ...daemonConfig,
            publicKey:  generateKeys(getDaemonOuputDir(daemonConfig.listener_port))[0]
        })

    ), numberOfDaemons);


    writePeersList(daemonConfigs);
};

const writePeersList = (daemonConfigs) => {
    const output = daemonConfigs.map(config => ({
        name: `daemon${config.listener_port}`,
        host: '127.0.0.1',
        port: config.listener_port,
        http_port: config.http_port,
        uuid: config.publicKey
    }));

    daemonConfigs.forEach(daemonConfig => writeDaemonFile(daemonConfig, 'peers.json', output).run());
};

const writeDaemonConfigObject = (config) => {
    getDaemonConfigTemplate()
        .map(createDaemonConfigObject(config))
        .flatMap(writeDaemonFile(config, `bluzelle-${config.listener_port}.json`))
        .run();
    return config;
};

const createDaemonConfigObject = curry(({listener_port, http_port}, template) => ({
    ...template,
    listener_port,
    http_port
}));


const getDaemonConfigTemplate = () => IO.of(require('./config-template'));

const counter = ({start, step = 1}) => {
    let count = start - 1;
    return () => count += step
};

setTimeout(() => writeSwarmConfig({numberOfDaemons: 3}));




