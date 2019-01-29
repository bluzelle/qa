const http = require('http')
const httpProxy = require('http-proxy');

const proxy = httpProxy.createProxyServer();

http.createServer((req, res) => {
    // This simulates an operation that takes 500ms to execute
    setTimeout(() => {
        proxy.web(req, res, {
            target: 'http://localhost:50000'
        });
    }, 500);
}).listen(51000);



