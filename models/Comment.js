const mongoose=require('mongoose');
const CommentSchema=new mongoose.Schema({
 issue:{type:mongoose.Schema.Types.ObjectId,ref:'Issue',required:true},
 user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
 text:{type:String,required:true,trim:true},
 parentComment:{type:mongoose.Schema.Types.ObjectId,ref:'Comment',default:null}
},{timestamps:true});
module.exports=mongoose.model('Comment',CommentSchema);
