const http = require('node:http');


// const backend = {
//     hostname: 'localhost',
//     port: 3001
// }

let backends = [
    {
        port: 3001,
        status: 'healthy'
    },
    {
        port: 3002,
        status: 'healthy'
    },
    {
        port: 3003,
        status: 'healthy'
    }
];

let currentBackendIndex = 0;

let attempts = 0;

const proxyRequest = (req, res, backend, attempts) => {
    if(attempts >= backends.length){
        res.writeHead(503, {'Content-Type': 'text/plain'});
        res.end('All backends are down. Please try again later.');
        return;
    }
    const options = {
        hostname: 'localhost',
        port: backend.port,
        path: req.url,
        method: req.method,
    }

    const request = http.request(options,(backendRes)=>{
        backendRes.on('data',(chunk)=>{
            res.write(chunk);
        })
        backendRes.on('end',()=>{
            res.end();
        })
    })
    request.on('error',(err)=>{
        console.error('Error in request to backend:', err);
        attempts++;
        backend.status = 'unhealthy';
        currentBackendIndex = (currentBackendIndex + 1) % backends.length;
        backend = backends[currentBackendIndex];
        proxyRequest(req,res,backend, attempts);
    })
    request.end()
}


const server = http.createServer((req,res)=>{  
    if (req.url === "/favicon.ico") {
        res.writeHead(204);
        return res.end();
    }
    console.log('Load Balancer got a request');


    let backend = backends[currentBackendIndex];

    while(backend.status !== 'healthy'){
        currentBackendIndex = (currentBackendIndex + 1) % backends.length;
        backend = backends[currentBackendIndex];
    }

    currentBackendIndex = (currentBackendIndex + 1) % backends.length;

    proxyRequest(req,res,backend, attempts);

    
})




console.log("Request created");

server.listen(3000,()=>{
    console.log('Server is running on port 3000');
})
