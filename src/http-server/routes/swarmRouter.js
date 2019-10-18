const Router = require('koa-router');
const swarmService = require('../services/swarmService');

const swarmRouter = new Router({prefix: '/swarms'});

swarmRouter.param('id', async function (id, ctx, next) {
    if (isNaN(ctx.params.id)) {
        return ctx.body = {
            status: 'fail',
            data: {
                swarmId: 'Swarm ID can only be an integer'
            }
        }
    }
    const swarmName = `swarm${ctx.params.id}`;
    ctx.swarm = await swarmService.getSwarm(swarmName);
    if (ctx.swarm === undefined) {
        return ctx.body = {
            status: 'fail',
            data: {
                swarmId: 'Swarm not found'
            }
        }
    }
    return next();
});

swarmRouter.get('/', async function (ctx, next) {
    try {
        const swarms = await swarmService.getSwarms();
        ctx.body = {
            status: 'success',
            data: {
                swarms
            }
        };
    } catch (err) {
        next(err);
    }
});

swarmRouter.post('/', async function (ctx, next) {

    if (isNaN(ctx.query.numberOfDaemons)) {
        ctx.body = {
            status: 'fail',
            data: {
                numberOfDaemons: 'Please provide valid integer'
            }
        }
    }

    try {
        const swarmInfo = await swarmService.generateSwarm(ctx.query.numberOfDaemons);
        ctx.set('Location', `/api/swarms/${swarmInfo.swarmId.substring(5)}`);
        ctx.body = {
            status: 'success'
        };
        ctx.status = 201;
    } catch (err) {
        next(err);
    }
});

swarmRouter.get('/start', async function (ctx, next) {
    try {
        await swarmService.startAll();
        ctx.body = {
            status: 'success'
        };
    } catch (err) {
        next(err);
    }
});

swarmRouter.get('/stop', async function (ctx, next) {
    try {
        await swarmService.stopAll();
        ctx.body = {
            status: 'success'
        };
    } catch (err) {
        next(err);
    }
});

swarmRouter.get('/removeState', async function (ctx, next) {
    try {
        await swarmService.removeSwarmState();
        ctx.body = {
            status: 'success'
        };
    } catch (err) {
        next(err);
    }
});

// specific swarm routes
swarmRouter.get('/:id', async function (ctx, next) {
    try {
        const swarmInfo = swarmService.swarmInfo(ctx.swarm);
        ctx.body = {
            status: 'success',
            data: swarmInfo
        };
    } catch (err) {
        next(err);
    }
    ;
});

swarmRouter.get('/:id/start', async function (ctx, next) {
    try {
        const swarmInfo = await swarmService.startSwarm(ctx.swarm);
        ctx.body = {
            status: 'success',
            data: swarmInfo
        };
    } catch (err) {
        next(err);
    }
});

swarmRouter.get('/:id/stop', async function (ctx, next) {
    try {
        const swarmInfo = await swarmService.stopSwarm(ctx.swarm);
        ctx.body = {
            status: 'success',
            data: swarmInfo
        };
    } catch (err) {
        next(err);
    }
});

swarmRouter.get('/:id/addDaemon', async function (ctx, next) {
    const addToRegistry = ctx.query.addToRegistry !== undefined ? ctx.query.addToRegistry : true;

    try {
        const swarmInfo = await swarmService.addDaemon(ctx.swarm, addToRegistry);
        ctx.body = {
            status: 'success',
            data: swarmInfo
        };
    } catch (err) {
        next(err);
    }
});

swarmRouter.get('/:id/startPartial', async function (ctx, next) {
    if (isNaN(ctx.query.numberOfDaemons)) {
        return ctx.body = {
            status:'fail',
            error: 'Please provide valid numberOfDaemons to start'
        }
    }

    try {
        const swarmInfo = await swarmService.startPartial(ctx.swarm, ctx.query.numberOfDaemons);
        ctx.body = {
            status: 'success',
            data: swarmInfo
        };
    } catch (err) {
        next(err);
    }
});

swarmRouter.get('/:id/startUnstarted', async function (ctx, next) {
    try {
        const swarmInfo = await swarmService.startUnstarted(ctx.swarm);
        ctx.body = {
            status: 'success',
            data: swarmInfo
        };
    } catch (err) {
        next(err);
    }
});

swarmRouter.get('/:id/primary', async function (ctx, next) {
    try {
        const primary = await swarmService.getPrimary(ctx.swarm);
        ctx.body = {
            status: 'success',
            primary: primary ? primary : 'No primary set or primary not found'
        };
    } catch (err) {
        next(err);
    }
});

swarmRouter.put('/:id/primary', async function (ctx, next) {
    try {
        const swarmInfo = await swarmService.setPrimary(ctx.swarm, ctx.request.body.publicKey);
        ctx.body = {
            status: 'success',
            data: swarmInfo
        };
    } catch (err) {
        next(err);
    }
});

swarmRouter.get('/:id/streams/', async function (ctx, next) {
    const identifier = ctx.query.identifier;

    if (identifier === undefined) {
        return ctx.body = {
            status: 'fail',
            data: {
                identifier: 'Please provide a publicKey or port to identify a node'
            }
        }
    }

    try {
        const stdoutStream = swarmService.getStream(ctx.swarm, ctx.query.identifier);

        if (stdoutStream === undefined) {
            ctx.status === 404;
            ctx.body = {error: `Node not found in Swarm`};
        }

        ctx.response.set('content-type', 'text/plain');
        ctx.body = stdoutStream;
    } catch (err) {
        console.log(err)
        next(err);
    }
});

module.exports = swarmRouter;
