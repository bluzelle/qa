const Router = require('koa-router');
const swarmRouter = require('./swarmRouter');

const apiRouter = new Router({prefix: '/api'});

const nestedRoutes = [swarmRouter];

for (let router of nestedRoutes) {
    apiRouter.use(router.routes(), router.allowedMethods())
};

module.exports = apiRouter;
