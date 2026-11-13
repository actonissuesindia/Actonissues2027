const mongoose=require('mongoose');
module.exports=mongoose.model('AuditLog',new mongoose.Schema({
 user:{type:mongoose.Schema.Types.ObjectId,ref:'User'},
 action:String,
 entity:String,
 entityId:String,
 ip:String,
 details:String
},{timestamps:true}));
