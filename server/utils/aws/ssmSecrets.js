const { getAwsInstance } = require("../aws/aws");

const AWS = getAwsInstance('SSM');
const ssmClient = new AWS.SSM({
    region: 'us-east-1'
});

const fetchSSMSecrets = async (secretKey="") => {

    if (!secretKey) {
        throw new Error("SSM Secret Key required!");
    }

    let params = {
        Name: secretKey,
        WithDecryption: true
    };
    
    let request;
    try {
        request = await ssmClient.getParameter(params).promise();
    } catch(err) {
        throw new Error(`Error while fetching ${secretKey} secret`);
    }

    return request.Parameter.Value;
}

module.exports = {
    fetchSSMSecrets
};
