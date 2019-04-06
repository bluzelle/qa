const sharedTests = require('../shared/tests');
const {remoteSwarmHook, localSwarmHooks} = require('../shared/hooks');


(harnessConfigs.testRemoteSwarm ? describe.only : describe)('smoke test', function () {

    (harnessConfigs.testRemoteSwarm ? remoteSwarmHook() : localSwarmHooks());

    sharedTests.crudFunctionality.apply(this);

    sharedTests.miscFunctionality.apply(this);

});
