const {harnessConfigs} = require('../resources/harness-configurations');

global.bluzelle = require('../bluzelle-js/lib/bluzelle-node').bluzelle;

global.chai = require('chai');
global.expect = chai.expect;
chai.use(require('chai-as-promised'));
chai.use(require('chai-json-schema'));
chai.use(require('chai-things'));
chai.should();

console.log('***************************************************************************************************************************************************');
console.log(`Test configurations. ethereumRPC: ${harnessConfigs.ethereumRpc}, esrContractAddress: ${harnessConfigs.esrContractAddress}, testRemoteSwarm: ${harnessConfigs.testRemoteSwarm}`);
console.log('***************************************************************************************************************************************************\n');
