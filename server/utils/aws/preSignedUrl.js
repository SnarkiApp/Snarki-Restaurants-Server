const { v4: uuidv4 } = require('uuid');
const { getAwsInstance } = require('../aws/aws');

const AWS = getAwsInstance('S3');
let s3 = new AWS.S3({signatureVersion: 'v4'});

// let getPresignedUrl = s3.getSignedUrl('getObject', {
//     Bucket: process.env.S3_BUCKET,
//     Key: 'image.jpg', //filename
//     Expires: 100 //time to expire in seconds
// });

const putPresignedUrl = async ({category = "newRestaurants"}) => {
    let conditionMatch = "eq";
    let defaultType = "application/pdf";

    if (category === "images") {
        conditionMatch = "starts-with",
        defaultType = "image/"
    }

    const params = {
        Bucket: process.env.S3_BUCKET,
        Conditions: [
            ['content-length-range', '0', '500000'],
            [conditionMatch, "$Content-Type", defaultType]
        ],
        Fields: {
            key: `${category}/${uuidv4()}`,
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
