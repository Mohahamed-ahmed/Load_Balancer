const http = require('node:http');


// const backend = {
//     hostname: 'localhost',
//     port: 3001
// }

let backends = [3001, 3002, 3003];

let currentBackendIndex = 0;


const server = http.createServer((req,res)=>{    
    console.log('Load Balancer got a request');


    let backend = backends[currentBackendIndex];

    currentBackendIndex = (currentBackendIndex + 1) % backends.length;


    
    const options = {
        hostname: 'localhost',
        port: backend,
        path: req.url,
        method: req.method,
    }
    console.log(
    "Current Index:",
    currentBackendIndex,
    "Selected Port:",
    backend
);
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
    })
    request.end()
})




console.log("Request created");

server.listen(3000,()=>{
    console.log('Server is running on port 3000');
})
