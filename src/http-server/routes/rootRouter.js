const Router = require('koa-router');
const apiRouter = require('./apiRouter');
const swarmManager = require('../services/swarmManagerService');

const rootRouter = new Router();

const nestedRoutes = [apiRouter];

for (let router of nestedRoutes) {
    rootRouter.use(router.routes(), router.allowedMethods())
};

rootRouter.get('/', async function (ctx, next) {
    try {
        const esrContractAddress = swarmManager.get().getEsrContractAddress();
        ctx.body = {
            status: 'success',
            message: 'swarmManager HTTP Interface successfully started',
            data: {
                esrContractAddress
                /*todo add swarm version*/
            }
        };
    } catch (err) {
        next(err);
    }
});

rootRouter.get('/api/routes', async function (ctx, next) {
    try {
        const routes = rootRouter.stack.map(i => i.path);
        ctx.body = {
            status: 'success',
            data: {
                routes
            }
        };
    } catch (err) {
        next(err);
    }
});

module.exports = rootRouter;
