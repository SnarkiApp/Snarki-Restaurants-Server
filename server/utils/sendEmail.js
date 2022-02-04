const client = require("@sendgrid/mail");
const constants = require("../utils/constants");

client.setApiKey(constants.sendgrid_api_key);

const sendEmail = async ({
    to = "",
    args = {}
}) => {

    if (!to) throw new Error("Missing Email Arguments");

    try {
        await client.send({
            to: {
                email: to
            },
            from: {
                email: constants.sendgrid_from_email,
                name: "SnarkiTech"
            },
            templateId: constants.sendgrid_contact_template_id,
            dynamicTemplateData: {...args}
        });
    } catch(err) {
        throw new Error(err);
    }

};

module.exports = {
    sendEmail
};
