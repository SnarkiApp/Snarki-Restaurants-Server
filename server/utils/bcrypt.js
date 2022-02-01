const bcrypt = require('bcryptjs');

const hashPassword = async (password  = "") => {
    if (!password) return "";

    const hashedPassword = await new Promise((resolve, reject) => {
        bcrypt.hash(password, 10, function(err, hash) {
            if (err) reject(err)
            resolve(hash);
        });
      })
    
      return hashedPassword;
}

module.exports = {
    hashPassword
};
