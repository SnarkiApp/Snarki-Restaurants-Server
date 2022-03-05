let AWS = require('aws-sdk');
const serviceSecretsMap = require('./serviceSecretsMap');

const getAwsInstance = (service = "") => {

    if (!service) {
        throw new Error("AWS service required!");
    }

    let credentials = {
        accessKeyId: serviceSecretsMap[service]['key'],
        secretAccessKey : serviceSecretsMap[service]['secret']
    };
    AWS.config.update({credentials: credentials, region: process.env.AWS_REGION});

    return AWS;

}

module.exports = {
    getAwsInstance
};
