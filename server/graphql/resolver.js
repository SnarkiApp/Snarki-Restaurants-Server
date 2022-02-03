const _ = require("lodash");
const jwt = require('jsonwebtoken');
const {
    findUser,
    addUser
} = require("../data/data");
const {hashPassword, comparePassword} = require("../utils/bcrypt");
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
            email: email.toLowerCase(),
            password: securePassword
        });

        return {
            code: 201,
            message: "User created successfully!",
        };

    } catch(err) {
        return {
            code: 500,
            message: "Something went wrong!",
        };
    }
};

const loginUser = async (data, res) => {
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
        const userDetails = await findUser({email: email.toLowerCase()});
        if (!userDetails) {
            return {
                code: 404,
                message: "No user found"
            };
        }

        let passwordMatch;
        try {
            passwordMatch = await comparePassword(password, userDetails.password);
        } catch(err) {
            throw new Error(err);
        }

        if (!passwordMatch) {
            return {
                code: 400,
                message: "Wrong Credentials"
            };
        }

        const authToken = jwt.sign({
            data: {
                email,
                userId: userDetails._id,
            }
        }, constants.TOKEN_SECRET, { expiresIn: 60*15 });

        const refreshToken = jwt.sign({
            data: {
                email,
                userId: userDetails._id,
            }
        }, constants.REFRESH_TOKEN_SECRET, { expiresIn: 60*60*24*7 });

        res.cookie('token', authToken, {
            maxAge: 60*20,
            httpOnly: true
        });

        res.cookie('refresh-token', refreshToken, {
            maxAge: 60*60*24*7,
            httpOnly: true
        });

        return {
            code: 200,
            message: "Authentication successfull",
        };

    } catch(err) {
        return {
            code: 500,
            message: "Something went wrong!",
        };
    }
};

module.exports = {
    loginUser,
    registerUser
}
