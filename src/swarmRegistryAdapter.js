// Run this first:
// npx ganache-cli --account="0x1f0d511e990ddbfec302e266d62542384f755f6cc6b3161b2e49a2a4e6c4be3d,100000000000000000000"
// account: 0xaa81f360c6bbef505b28760fee25443f9d33e499

const Web3 = require('web3');
const contract = require('truffle-contract');
const BluzelleESRJson = require('../BluzelleESR/build/contracts/BluzelleESR.json');

const web3 = new Web3('http://127.0.0.1:8545');
const receipts = [];

const myAccount = "0xaa81f360c6bbef505b28760fee25443f9d33e499"; // this account id is related to above ganache-cli account

exports.deploy = async function () {
    const MyContract = contract(BluzelleESRJson);
    MyContract.setProvider('http://127.0.0.1:8545');

    const BluzelleESRInstance = await MyContract.new({from: myAccount});

    const receiptTx = await web3.eth.getTransactionReceipt(BluzelleESRInstance.transactionHash);
    recordTransaction("BluzelleESR.new", receiptTx, false);

    return BluzelleESRInstance;
};


exports.addSwarm = async function (swarm, BluzelleESRInstance) {
    await BluzelleESRInstance.addSwarm(swarm.swarm_id, 7, "Canada", true, "Disk", 0, [], {from: myAccount});

    for (var i = 0; i < swarm.peers.length; i++) {

        await BluzelleESRInstance.addNode(
            swarm.swarm_id,
            swarm.peers[i].host,
            swarm.peers[i].name,
            swarm.peers[i].http_port,
            swarm.peers[i].port,
            swarm.peers[i].uuid,
            {from: myAccount}
        );
    }
};

//record transaction summary
function recordTransaction(description, receipt, display) {
    if (display) {
        console.log("TxID     : " + receipt.transactionHash);
        console.log("Gas used : " + receipt.gasUsed);
    }

    receipts.push([description, receipt]);
};
