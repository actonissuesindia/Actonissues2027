const mongoose=require('mongoose');
module.exports=mongoose.model('Activity',new mongoose.Schema({
 issue:{type:mongoose.Schema.Types.ObjectId,ref:'Issue',required:true},
 user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
 action:{type:String,required:true},
 details:String
},{timestamps:true}));
