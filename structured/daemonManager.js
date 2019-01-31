const {times, invoke, pipe, curry, pick} = require('lodash/fp');
const {writeDaemonFile, writeJsonFile, removeDaemonDirectory, getDaemonOutputDir, copyToDaemonDir} = require('./FileService');
const {generateKeys} = require('./crypto');
const {IO} = require('monet');
const { spawn } = require('child_process');
const {resolve: resolvePath} = require('path');


//setTimeout(() => exports.startSwarm({numberOfDaemons: 3}));

exports.startSwarm = async ({numberOfDaemons}) => {
    const daemonConfigs = writeSwarmConfig({numberOfDaemons});
    daemonConfigs.forEach(copyDaemonBinary);
    const daemons = await Promise.all(daemonConfigs.map(startDaemon));
    return {
        stop: () => daemons.forEach(invoke('stop')),
        daemons: daemons
    }
};

const startDaemon = daemonConfig => new Promise((resolve, reject) => {
    const [isRunning, setRunning] = useState(false);
    console.log('starting daemon:', daemonConfig.listener_port);
    const daemon = spawn('./swarm', ['-c', `bluzelle-${daemonConfig.listener_port}.json`], {cwd: getDaemonOutputDir(daemonConfig), stdio: 'ignore'});


    setTimeout(() => resolve({
        ...daemonConfig,
        isRunning,
        stop: () => console.log('stopping daemon') || daemon.kill()
    }
), 10000);

    // daemon.stdout.on('data', (buf) => {
    //     const out = buf.toString();
    //     isRunning() && out.includes('Running node with ID') && (setRunning(true) && resolve());
    //     console.log(`daemon-${daemonConfig.listener_port}:`, out);
    // });
    //
    // daemon.stdout.on('readable', (...args) => {
    //     console.log('***** readable', args, daemon.stdout.readableLength)
    // });
    //
    // daemon.stderr.on('data', (buf) => console.log(`daemon-${daemonConfig.listener_port}: ERROR:`, buf.toString()));


    daemon.on('close', (code) => {
        setRunning(false);
        console.log('Daemon exit: ', code)
    });

});

const useState = (initialValue) => {
    let value = initialValue;
    return [
        () => value,
        (newValue) => value = newValue
    ]
};

const copyDaemonBinary = (daemonConfig) => copyToDaemonDir(daemonConfig, resolvePath(__dirname, '../daemon-build/output/swarm'), 'swarm').run();

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





