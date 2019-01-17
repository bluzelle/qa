/*
* Class used to manage generated daemons' information and state.
* */

module.exports = class SwarmState {

    constructor (configsObject) {
        this._liveNodes = [];
        this.load(configsObject);
    }

    get nodes() {
        // returns an array of arrays of [daemon#, pubKey] pairs, sorted lexicographically by pubKey
        return this._nodes
    }

    set liveNodes(arr) {
        this._liveNodes = arr
    }

    get liveNodes() {
        return this._liveNodes
    }

    pushLiveNodes(node) {
        this._liveNodes.push(node)
    }

    set primary(node) {
        this._primary = node
    }

    get primary() {
        return this._primary
    }

    get backups() {
        if (this._primary) {
            return this._liveNodes.filter((node) => node !== this._primary)
        } else {
            return new Error('No primary set')
        }
    }

    get lastNode() {
        return this._nodes[this._nodes.length - 1]
    }

    declareDeadNode(daemon) {
        if (nodeExistsInLiveNodes.call(this, daemon)) {
            this._liveNodes.splice(this._liveNodes.indexOf(daemon),1);
        }

        if (this[daemon].stream){
            this[daemon].stream = null
        }
    }

    load(configsObject) {

        const _temp = [];

        configsObject.forEach(data => {

            this[`daemon${data.index}`] =
                {
                    uuid: data.uuid,
                    port: data.content.listener_port,
                    http_port: data.content.http_port,
                    index: data.index
                };

            _temp.push([ data.uuid, `daemon${data.index}`]);
        });

        this._nodes = _temp.sort();
    }
};

function nodeExistsInLiveNodes (daemon) {
    return this._liveNodes.indexOf(daemon) >= 0;
}
