// load env variables from qa/.env if it exists
require('dotenv').config();

global.bluzelle = require('../bluzelle-js/lib/bluzelle-node').bluzelle;

global.chai = require('chai');
global.expect = chai.expect;
chai.use(require('chai-as-promised'));
chai.use(require('chai-json-schema'));
chai.use(require('chai-things'));
chai.should();

global.harnessConfigs = {
    address: process.env.ADDRESS ? process.env.ADDRESS : 'localhost',
    port: process.env.PORT ? parseInt(process.env.PORT) : 50000,
    numOfNodes: process.env.NUM_OF_NODES ? parseInt(process.env.NUM_OF_NODES) : 4,
    clientUuid: '4982e0b0-0b2f-4c3a-b39f-26878e2ac814',
    clientPem: 'MHQCAQEEIFH0TCvEu585ygDovjHE9SxW5KztFhbm4iCVOC67h0tEoAcGBSuBBAAKoUQDQgAE9Icrml+X41VC6HTX21HulbJo+pV1mtWn4+evJAi8ZeeLEJp4xg++JHoDm8rQbGWfVM84eqnb/RVuIXqoz6F9Bg=='
};
