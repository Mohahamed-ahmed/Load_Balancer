const http = require('node:http');

const server1 = http.createServer((req,res)=>{    
    console.log(req.url, req.method);
    if (req.url === "/favicon.ico") {
        res.writeHead(204);
        return res.end();
    }
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Hello from Backend 1!');
})

server1.listen(3001,()=>{
    console.log('Server 1 is running on port 3001');
})