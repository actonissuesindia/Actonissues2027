const gcs=require('../services/gcsService');

exports.upload=async(req,res)=>{
 try{
  const {url}=await gcs.uploadFile(req.file);
  res.json({success:true,url});
 }catch(err){
  console.error(err);
  res.status(500).json({success:false});
 }
};
