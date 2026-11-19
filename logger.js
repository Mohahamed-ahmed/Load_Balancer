const log=(event,data)=>{
    console.log(JSON.stringify({
        event,
        data,
        timestamp: new Date().toISOString()
    }))
}

module.exports = {log};