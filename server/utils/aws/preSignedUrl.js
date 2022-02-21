require('dotenv').config();
let AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

let credentials = {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey : process.env.S3_SECRET_KEY
};
AWS.config.update({credentials: credentials, region: process.env.S3_REGION});
let s3 = new AWS.S3({signatureVersion: 'v4'});

// let getPresignedUrl = s3.getSignedUrl('getObject', {
//     Bucket: process.env.S3_BUCKET,
//     Key: 'image.jpg', //filename
//     Expires: 100 //time to expire in seconds
// });

const putPresignedUrl = async () => {
    const params = {
        Bucket: process.env.S3_BUCKET,
        Conditions: [
            ['content-length-range', '0', '1000000'],
            ["eq", "$Content-Type", "application/pdf"]
        ],
        Fields: {
            key: uuidv4(), 
        },
        Expires: 60*5
    };
    try {
        const response = await s3.createPresignedPost(params);
        return JSON.stringify(response);
    } catch(err) {
        throw new Error(err);
    }
}

module.exports = {
    putPresignedUrl
};
