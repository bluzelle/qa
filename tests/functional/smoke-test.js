const sharedTests = require('../shared/tests');
const {remoteSwarmHook, localSwarmHooks} = require('../shared/hooks');


(harnessConfigs.testRemoteSwarm ? describe.only : describe)('smoke test', function () {

    const clientsObj = {};

    (harnessConfigs.testRemoteSwarm ? remoteSwarmHook() : localSwarmHooks());

    before('set api to clientsObj', function () {
        clientsObj.api = this.api;
    });

    sharedTests.crudFunctionality(clientsObj);

    sharedTests.miscFunctionality(clientsObj);

});
