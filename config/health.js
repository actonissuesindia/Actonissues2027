module.exports=(req,res)=>{
  res.json({
    status:'UP',
    timestamp:new Date().toISOString(),
    uptime:process.uptime()
  });
};
