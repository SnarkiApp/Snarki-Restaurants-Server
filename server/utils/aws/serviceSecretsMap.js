require('dotenv').config();

module.exports = {
    S3: {
        key: process.env.S3_ACCESS_KEY,
        secret: process.env.S3_SECRET_KEY
    },
    SSM: {
        key: process.env.SSM_ACCESS_KEY,
        secret: process.env.SSM_SECRET_KEY
    }
};
