const mongoose=require('mongoose');
module.exports=mongoose.model('Notification',new mongoose.Schema({
 user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
 title:String,
 message:String,
 link:String,
 read:{type:Boolean,default:false}
},{timestamps:true}));
