const Koa = require('koa');
const logger = require('koa-logger');
const rootRouter = require('./routes/rootRouter');
const swarmManager = require('./services/swarmManagerService');
const bodyParser = require('koa-bodyparser');
const exitHook = require('async-exit-hook');


const app = new Koa();
if (process.env.NODE_ENV !== 'testing') {
    app.use(logger());
};

app.use(bodyParser());

app.use(rootRouter.routes(), rootRouter.allowedMethods());

// 404 handler
app.use(async (ctx, next) => {
    try {
        await next()
        if (ctx.status === 404) {

            ctx.status = 404;
            ctx.body = {
                status: 'fail',
                message: 'Route not found'
            }
        }
    } catch (err) {
        // handle error
    }
});

// general error handler
app.use(async (ctx, next) => {
    try {
        await next();
    } catch (err) {
        ctx.status = err.status || 500;
        ctx.body = {
            status: 'error',
            message: err.message || 'something went wrong'
        };
        ctx.app.emit('error', err, ctx);
    }
});

app.on('error', (err) => {
    console.error('App level error handler: ', err)
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('unhandled promise')
    console.error('reason: ', reason)
    console.error('promise: ', promise)

    if (reason.name === 'OperationError') {
        process.exit(1);
    }
});

// async shutdown hook
exitHook(done => {
    const mgr = swarmManager.get();
    mgr
        .stopAll()
        .then(() => {
            mgr.disconnectEsr();
            done();
            })
        .catch(err => {
            console.error('Error stopping swarm: ', err);
            done();
        })
});

// initialize swarmManager and deploy ESR contract
swarmManager.initialize()
    .then(() => {
        console.log('HTTP Server started!')
        if (!module.parent) {
            app.listen(3000);
        };
    });

module.exports = app;
