const chai = require('chai');
const chaiHttp = require('chai-http');
const expect = chai.expect;
const app = require('../app');

chai.use(chaiHttp);

describe('routes', () => {

    const numberOfDaemons = 3;

    beforeEach(async function () {
        this.app = app.listen(3001);
        await new Promise(res => setTimeout(res, 1000))
    });

    afterEach(function () {
        this.app.close();
    });

    it('GET "/" root should show success message', async function ()  {
        await chai
            .request(this.app)
            .get('/')
            .then(( res) => {
                expect(res).to.have.status(200);
                expect(res.body).to.have.property('status');
                expect(res.body.status).to.eql('success');

                expect(res.body.message).to.eql('swarmManager HTTP Interface successfully started');
                expect(res.body.data).to.have.property('esrContractAddress');
                expect(res.body.data.esrContractAddress).to.be.a('string').that.is.not.empty;
            });
    });

    it('GET "/api/routes/" should list all routes', async function ()  {
        await chai
            .request(this.app)
            .get('/api/routes')
            .then((res) => {
                expect(res).to.have.status(200);
                expect(res.body).to.have.property('status');
                expect(res.body.status).to.eql('success');

                expect(res.body).to.have.property('data');
                expect(res.body.data).to.have.property('routes');
                expect(res.body.data.routes).to.be.an('array').that.is.not.empty;
            });
    });

    it('GET "/api/swarms/:id" should fail when swarm :id does not exist', async function ()  {
        await chai
            .request(this.app)
            .get('/api/swarms/0')
            .then((res) => {
                expect(res).to.have.status(200);
                expect(res.body).to.have.property('status');
                expect(res.body.status).to.eql('fail');

                expect(res.body).to.have.property('data');
                expect(res.body.data).to.have.property('swarmId');
                expect(res.body.data.swarmId).to.eql('Swarm not found');
            });
    });

    it('GET "/api/swarms/start" should return success status', async function ()  {
        await chai
            .request(this.app)
            .get('/api/swarms/start')
            .then(( res) => {
                expect(res).to.have.status(200);
                expect(res.body).to.have.property('status');
                expect(res.body.status).to.eql('success');
            });
    });

    it('GET "/api/swarms/stop" should return success status', async function ()  {
        await chai
            .request(this.app)
            .get('/api/swarms/stop')
            .then((res) => {
                expect(res).to.have.status(200);
                expect(res.body).to.have.property('status');
                expect(res.body.status).to.eql('success');
            });
    });

    it('GET "/api/swarms/:id/start" should return fail status', async function ()  {
        await chai
            .request(this.app)
            .get('/api/swarms/0/start')
            .then((res) => {
                expect(res).to.have.status(200);
                expect(res.body).to.have.property('status');
                expect(res.body.status).to.eql('fail');
            });
    });

    it('GET "/api/swarms/:id/stop" should return fail status', async function ()  {
        await chai
            .request(this.app)
            .get('/api/swarms/0/stop')
            .then((res) => {
                expect(res).to.have.status(200);
                expect(res.body).to.have.property('status');
                expect(res.body.status).to.eql('fail');
            });
    });

    it('POST "/api/swarms/" should generate new swarm', async function () {
        await chai
            .request(this.app)
            .post('/api/swarms')
            .query({numberOfDaemons})
            .then(( res) => {
                expect(res).to.have.status(201);
                expect(res.body).to.have.property('status');
                expect(res.body.status).to.eql('success');

                expect(res.headers).to.have.property('location');
                expect(res.headers.location).to.eql('/api/swarms/0');
            });
    });

    context('with a swarm', function () {

        beforeEach('POST "/api/swarms/" should generate new swarm', async function () {
            await chai
                .request(this.app)
                .post('/api/swarms')
                .query({numberOfDaemons})
                .then((res) => {
                    expect(res).to.have.status(201);
                    expect(res.body).to.have.property('status');
                    expect(res.body.status).to.eql('success');

                    expect(res.headers).to.have.property('location');
                    this.swarmPath = res.headers.location;
                });
        });

        afterEach('kill swarm', async function () {
            await chai
                .request(this.app)
                .get(this.swarmPath + '/stop')
        });

        it('GET "/api/swarms/:id" should return swarm info when it exists', async function ()  {
            await chai
                .request(this.app)
                .get(this.swarmPath)
                .then((res) => {
                    expect(res).to.have.status(200);

                    expect(res.body).to.have.property('data');
                    expect(res.body.data).to.have.property('swarmId');

                    expect(res.body.data).to.have.property('nodeUpStatus');
                    expect(Object.values(res.body.data.nodeUpStatus).every(node => node.isRunning === false)).to.be.true;
                    expect(Object.keys(res.body.data.nodeUpStatus)).to.have.lengthOf(numberOfDaemons);

                    expect(res.body.data).to.have.property('bootstrapPeersList');
                    expect(Object.keys(res.body.data.bootstrapPeersList)).to.have.lengthOf(numberOfDaemons);
                });
        });

        it('GET "/api/swarms/:id/start" should return success status', async function ()  {
            await chai
                .request(this.app)
                .get(this.swarmPath)
                .then((res) => {
                    expect(res).to.have.status(200);
                    expect(res.body).to.have.property('status');
                    expect(res.body.status).to.eql('success');
                });
        });

        it('GET "/api/swarms/:id/stop" should return success status', async function ()  {
            await chai
                .request(this.app)
                .get(this.swarmPath)
                .then((res) => {
                    expect(res).to.have.status(200);
                    expect(res.body).to.have.property('status');
                    expect(res.body.status).to.eql('success');
                });
        });

        it('GET "/api/swarms/:id/addDaemon" should return success status with addToRegistry set to true', async function ()  {
            await chai
                .request(this.app)
                .get(this.swarmPath + '/addDaemon')
                .query({addToRegistry: true })
                .then((res) => {
                    expect(res).to.have.status(200);
                    expect(res.body).to.have.property('status');
                    expect(res.body.status).to.eql('success');
                });
        });

        it('GET "/api/swarms/:id/addDaemon" should return success status with addToRegistry set to false', async function ()  {
            await chai
                .request(this.app)
                .get(this.swarmPath + '/addDaemon')
                .query({addToRegistry: false })
                .then((res) => {
                    expect(res).to.have.status(200);
                    expect(res.body).to.have.property('status');
                    expect(res.body.status).to.eql('success');
                });
        });

        it('GET "/api/swarms/:id/addDaemon" should return success status without addToRegistry', async function ()  {
            await chai
                .request(this.app)
                .get(this.swarmPath + '/addDaemon')
                .then((res) => {
                    expect(res).to.have.status(200);
                    expect(res.body).to.have.property('status');
                    expect(res.body.status).to.eql('success');
                });
        });

        it('GET "/api/swarms/:id/startPartial" should return fail status if no numberOfDaemons included', async function ()  {
            await chai
                .request(this.app)
                .get(this.swarmPath + '/startPartial')
                .then((res) => {
                    expect(res).to.have.status(200);
                    expect(res.body).to.have.property('status');
                    expect(res.body.status).to.eql('fail');
                    expect(res.body.error).to.eql('Please provide valid numberOfDaemons to start');
                });
        });

        it('GET "/api/swarms/:id/startPartial" should return success status with numberOfDaemons included', async function ()  {
            await chai
                .request(this.app)
                .get(this.swarmPath + '/startPartial')
                .query({numberOfDaemons: 2})
                .then((res) => {
                    expect(res).to.have.status(200);
                    expect(res.body).to.have.property('status');
                    expect(res.body.status).to.eql('success');
                });
        });

        it('GET "/api/swarms/:id/startUnstarted', async function ()  {
            await chai
                .request(this.app)
                .get(this.swarmPath + '/startUnstarted')
                .query({numberOfDaemons: 2})
                .then((res) => {
                    expect(res).to.have.status(200);
                    expect(res.body).to.have.property('status');
                    expect(res.body.status).to.eql('success');
                });
        });

        it('GET "/api/swarms/:id/primary should return primary if set', async function ()  {
            await chai
                .request(this.app)
                .get(this.swarmPath + '/primary')
                .then(res => {
                    expect(res).to.have.status(200);
                    expect(res.body).to.have.property('status');
                    expect(res.body.status).to.eql('success');
                    expect(res.body).to.have.property('primary');
                    expect(res.body.primary).to.be.eql('No primary set or primary not found');
                })
        });

        it('PUT "/api/swarms/:id/primary should set primary if publicKey is found in swarm', async function ()  {
            const requester = chai.request(this.app).keepOpen();

            const getAPublicKeyFromSwarm = () => {
                return requester.get(this.swarmPath)
                    .then(res => {
                        firstNodePublicKey = res.body.data.bootstrapPeersList[0].uuid;
                        return firstNodePublicKey
                    });
            };

            const setNewPrimary = (pubKey) => {
                return requester
                    .put(this.swarmPath + '/primary')
                    .send({publicKey: firstNodePublicKey})
                    .then(() => pubKey);
            };

            const validatePrimarySet = (pubKey) => {
                return requester
                    .get(this.swarmPath + '/primary')
                    .then(res => {
                        expect(res.body.primary).to.not.be.eql('No primary set or primary not found');
                        expect(res.body.primary.publicKey).to.be.eql(pubKey);
                    });
            };

            await Promise.resolve()
                .then(() => getAPublicKeyFromSwarm())
                .then((pubKey) => setNewPrimary(pubKey))
                .then((pubKey) => validatePrimarySet(pubKey))
                .then(() => {
                    requester.close();
                });
        });

        it('GET "/api/swarms/:id/streams/?identifier= should fetch stream for specified node if it exists', async function () {
            this.timeout(5000)
            const requester = chai.request(this.app).keepOpen();

            const startSwarm = () => requester.get(this.swarmPath + '/start');

            const getAPublicKeyFromSwarm = () => {
                return requester.get(this.swarmPath)
                    .then(res => {
                        firstNodePublicKey = res.body.data.bootstrapPeersList[0].uuid;
                        return firstNodePublicKey
                    });
            };

            const getStream = (pubKey) => {
                return requester
                    .get(this.swarmPath + '/streams/')
                    .query({identifier: pubKey})
                    .then(res => {
                        return res
                    })
            };

            const validate = (stream) => {
                expect(typeof stream.on === 'string').to.be.true
            };

            /*
            * Request doesn't end until test times out and that's when validate()
            * and the last .then runs; after failure
            * */

            await Promise.resolve()
                .then(() => startSwarm())
                .then(() => getAPublicKeyFromSwarm())
                .then((pubKey) => getStream(pubKey))
                .then((stream) => validate(stream))
                .then(() => {
                    requester.close();
                });
        });




    });
});
