const bcrypt = require('bcryptjs');

const hashPassword = async (password  = "") => {
    if (!password) return "";

    const hashedPassword = await new Promise((resolve, reject) => {
        bcrypt.hash(password, 10, function(err, hash) {
            if (err) reject(err)
            resolve(hash);
        });
    });
    
    return hashedPassword;
}

const comparePassword = async (password  = "", hash = "") => {
    if (!password || !hash) return false;

    const passwordMatch = await new Promise((resolve, reject) => {
        bcrypt.compare(password, hash, function(err, res) {
            if (err) reject(err);
            resolve(res);
        });
    });
    
    return passwordMatch;
}

module.exports = {
    comparePassword,
    hashPassword
};
