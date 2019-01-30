const {times, invoke, pipe, curry, pick} = require('lodash/fp');
const {writeDaemonFile, writeJsonFile, removeDaemonDirectory, getDaemonOutputDir, copyToDaemonDir} = require('./FileService');
const {generateKeys} = require('./crypto');
const {IO} = require('monet');


setTimeout(() => startSwarm({numberOfDaemons: 3}));

const startSwarm = ({numberOfDaemons}) => {
    const daemonConfigs = writeSwarmConfig({numberOfDaemons});
    daemonConfigs.forEach(copyDaemonBinary);
    const daemons = daemonConfigs.forEach(startDaemon);
    return {
        stop: () => daemons.forEach(invoke('stop'))
    }
};

const startDaemon = daemonConfig => {

    console.log('****', daemonConfig);
};

const copyDaemonBinary = (daemonConfig) => copyToDaemonDir(daemonConfig, '../daemon-build/output/swarm', 'swarm').run();

const writeSwarmConfig = ({numberOfDaemons}) => {
    const assignListenerPort = counter({start: 50000});
    const assignHttpPort = counter({start: 8080});

    removeDaemonDirectory().run();

    const daemonConfigs = times(pipe(
        () => writeDaemonConfigObject({
            listener_port: assignListenerPort(),
            http_port: assignHttpPort()
        }),

        daemonConfig => ({
            ...daemonConfig,
            publicKey: generateKeys(getDaemonOutputDir(daemonConfig))[0]
        })
    ), numberOfDaemons);


    writePeersList(daemonConfigs);

    return daemonConfigs;
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





