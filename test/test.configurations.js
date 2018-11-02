global.harnessConfigs = {
    address: process.env.address ? process.env.address : 'localhost',
    port: process.env.port ? parseInt(process.env.port) : 50000,
    numOfNodes: process.env.numOfNodes ? parseInt(process.env.numOfNodes) : 10,
    pathToKeyFile: './private.pem'
};
