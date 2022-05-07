const client = require("@sendgrid/mail");
const constants = require("../utils/constants");
const ssmKeys = require('./aws/ssmKeys');
const { fetchSSMSecrets } = require('./aws/ssmSecrets');

const sendEmail = async ({
    to = "",
    templateId = "",
    setReplyTo = "",
    args = {}
}) => {

    if (!to || !templateId) throw new Error("Missing Required Arguments");
    
    const apiKey = await fetchSSMSecrets(ssmKeys.sendGridApiKey);
    client.setApiKey(apiKey);

    try {
        await client.send({
            templateId,
            to: {
                email: to
            },
            from: {
                email: constants.sendgrid_from_email,
                name: "Snarki"
            },
            replyTo: {
                email: setReplyTo ? setReplyTo : constants.sendgrid_from_email
            },
            dynamicTemplateData: {...args}
        });
    } catch(err) {
        throw new Error(err);
    }

};

module.exports = {
    sendEmail
};
