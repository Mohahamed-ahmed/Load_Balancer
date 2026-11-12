const http = require('node:http');

const server2 = http.createServer((req,res)=>{    
    if (req.url === "/favicon.ico") {
        res.writeHead(204);
        return res.end();
    }
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Hello from Backend 2!');
})

server2.listen(3002,()=>{
    console.log('Server 2 is running on port 3002');
})