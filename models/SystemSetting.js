const mongoose=require('mongoose');
module.exports=mongoose.model('SystemSetting',new mongoose.Schema({
key:{type:String,unique:true},
value:String,
description:String
},{timestamps:true}));
