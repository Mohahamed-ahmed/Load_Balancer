const http = require('node:http');

const server3 = http.createServer((req,res)=>{   
    if (req.url === "/favicon.ico") {
        res.writeHead(204);
        return res.end();
    } 
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Hello from Backend 3!');
})



server3.listen(3003,()=>{
    console.log('Server 3 is running on port 3003');
})