let AWS = require('aws-sdk');
const serviceSecretsMap = require('./serviceSecretsMap');

const getAwsInstance = (service = "") => {

    if (!service) {
        throw new Error("AWS service required!");
    }

    // let credentials = {
    //     accessKeyId: serviceSecretsMap[service]['key'],
    //     secretAccessKey : serviceSecretsMap[service]['secret']
    // };
    AWS.config.update({region: 'us-east-1'});
    // AWS.config.update({credentials: credentials, region: 'us-east-1'});

    return AWS;

}

module.exports = {
    getAwsInstance
};
