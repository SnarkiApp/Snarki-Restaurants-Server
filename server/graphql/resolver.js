const _ = require("lodash");
const {
    findUser,
    addUser
} = require("../data/data");
const {hashPassword} = require("../utils/bcrypt");
const constants = require("../utils/constants");

const registerUser = async data => {
    const {email, password} = data;

    if (!email || !password) {
        return {
            code: 400,
            message: "missing arguments"
        }
    }

    const emailValidation = constants.emailRegex.test(email);
    const passwordValidation = constants.passwordRegex.test(password);

    if (!emailValidation || !passwordValidation) {
        return {
            code: 400,
            message: "Validation Failed"
        };
    }

    try {
        const userDetails = await findUser({email});
        if (userDetails) {
            return {
                code: 409,
                message: "User with same email already exists!"
            };
        }

        let securePassword;
        try {
            securePassword = await hashPassword(password);
        } catch(err) {
            throw new Error(err);
        }

        await addUser({
            email,
            password: securePassword
        });

        return {
            code: 201,
            message: "User created successfully!",
        };

    } catch(err) {
        console.log(err);
        return {
            code: 500,
            message: "Something went wrong!",
        };
    }
};

module.exports = {
    registerUser
}
