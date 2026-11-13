const fs=require('fs');
const path=require('path');
const logFile=path.join(process.cwd(),'application.log');

exports.info=(msg)=>fs.appendFileSync(logFile,`INFO ${new Date().toISOString()} ${msg}\n`);
exports.error=(msg)=>fs.appendFileSync(logFile,`ERROR ${new Date().toISOString()} ${msg}\n`);
