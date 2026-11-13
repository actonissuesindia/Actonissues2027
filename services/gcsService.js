const {bucket}=require('../config/gcs');
const path=require('path');
const crypto=require('crypto');

// The bucket already has public read granted at the bucket level (uniform
// bucket-level access), so individual objects can't be made public one at a
// time — calling file.makePublic() would fail with that setting enabled.
// The public URL just works once the object is saved.
exports.uploadFile=async(file)=>{
 // Never build the object key from the attacker-controlled originalname
 // directly — GCS treats "/" as a path separator, so a crafted name could
 // land the object somewhere unexpected in the bucket, and unescaped
 // special characters would break the direct URL built below.
 const ext=path.extname(file.originalname).toLowerCase();
 const fileName=`${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
 await bucket.file(fileName).save(file.buffer, {
  contentType: file.mimetype,
  resumable: false
 });
 return { fileName, url: `https://storage.googleapis.com/${bucket.name}/${fileName}` };
};

exports.deleteFile=async(filename)=>{
 await bucket.file(filename).delete();
};

// Same as uploadFile above but for a buffer this server generated rather
// than a file someone sent, so the caller names it — a derived file (a link
// preview card, see services/ogImageService.js) needs a name it can work out
// again later from what it was derived from, not a fresh random one.
exports.saveBuffer=async(fileName,buffer,contentType)=>{
 await bucket.file(fileName).save(buffer,{ contentType, resumable:false });
 return `https://storage.googleapis.com/${bucket.name}/${fileName}`;
};

// Returns null rather than throwing when the object simply isn't there —
// "have I built this before?" is a normal question with a normal negative
// answer, not an error.
exports.readBuffer=async(fileName)=>{
 try {
  const [buffer]=await bucket.file(fileName).download();
  return buffer;
 } catch(err) {
  if (err.code===404) return null;
  throw err;
 }
};

exports.getSignedUrl=async(filename)=>{
 const [url]=await bucket.file(filename).getSignedUrl({
  action:'read',
  expires:Date.now()+60*60*1000
 });
 return url;
};
