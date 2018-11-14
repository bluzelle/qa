// load env variables from qa/.env if it exists
require('dotenv').config();

global.harnessConfigs = {
    address: process.env.ADDRESS ? process.env.ADDRESS : 'localhost',
    port: process.env.PORT ? parseInt(process.env.PORT) : 50000,
    numOfNodes: process.env.NUM_OF_NODES ? parseInt(process.env.NUM_OF_NODES) : 10,
    pathToKeyFile: './private.pem'
};
