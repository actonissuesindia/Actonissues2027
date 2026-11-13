const {Storage}=require('@google-cloud/storage');

const storage=new Storage({
 keyFilename:process.env.GCS_KEY_FILE,
 projectId:process.env.GCS_PROJECT_ID
});

module.exports={
 storage,
 bucket:storage.bucket(process.env.GCS_BUCKET)
};
