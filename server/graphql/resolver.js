const _ = require("lodash");
const {ObjectId} = require('mongodb');
const jwt = require('jsonwebtoken');
const {
    findUser,
    addUser,
    getRestaurants,
    findRestaurant,
    findVerificationRecords,
    addDocumentsVerification,
    findClaimRestaurantRequests,
    registerRestaurantVerification,
    findRegisterRestaurantRequests
} = require("../data/data");
const {hashPassword, comparePassword} = require("../utils/bcrypt");
const constants = require("../utils/constants");
const { sendEmail } = require("../utils/sendEmail");
const { putPresignedUrl } = require("../utils/aws/preSignedUrl");

const registerUser = async data => {
    const {email, password, role} = data;

    if (!email || !password || !role) {
        return {
            code: 400,
            message: "missing arguments"
        }
    }

    if (role != "RESTAURANT") {
        return {
            code: 401,
            message: "Invalid Role"
        };
    }

    const emailValidation = constants.emailRegex.test(email);
    const passwordValidation = password.length >= 10;
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
            role,
            email: email.toLowerCase(),
            password: securePassword,
            verified: false
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

const loginUser = async (data) => {
    const {email, password} = data;

    if (!email || !password) {
        return {
            code: 400,
            message: "missing arguments"
        }
    }

    const emailValidation = constants.emailRegex.test(email);
    const passwordValidation = password.length >= 10;
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
        }, constants.TOKEN_SECRET, { expiresIn: 60*60*24 });

        delete userDetails.password;

        return {
            code: 200,
            token: authToken,
            meData: {...userDetails},
            message: "Authentication successfull",
        };

    } catch(err) {
        return {
            code: 500,
            message: "Something went wrong!",
        };
    }
};

const contactSnarki = async (data) => {
    const {
        email,
        firstName = "",
        lastName = "",
        comments = ""
    } = data;

    if (!email) {
        return {
            code: 400,
            message: "missing arguments"
        }
    }

    const emailValidation = constants.emailRegex.test(email);
    if (!emailValidation) {
        return {
            code: 400,
            message: "Validation Failed"
        };
    }

    try {
        await sendEmail({
            to: constants.sendgrid_contact_to_email,
            templateId: constants.sendgrid_contact_template_id,
            args: {
                email,
                firstName,
                lastName,
                comments
            }
        });

        return {
            code: 200,
            message: "Contact email sent",
        };
    } catch(err) {
        return {
            code: 500,
            message: "Something went wrong!",
        };
    }
};

const me = async user => {
    if (!user) {
        return {
            code: 401,
            message: "Unauthorised"
        }
    }

    try {
        const userDetails = await findUser({email: user.email});
        if (!userDetails) {
            return {
                code: 400,
                message: "User not found!"
            };
        }

        delete userDetails.password;

        return {
            code: 200,
            meData: {...userDetails},
            message: "User details fetched successfully",
        };

    } catch(err) {
        return {
            code: 500,
            message: "Something went wrong!",
        };
    }
};

const getRestaurantsList = async (args, user) => {
    if (!user) {
        return {
            code: 401,
            message: "Unauthorised"
        }
    }

    try {
        const restaurants = await getRestaurants({
            searchText: args.name.toLowerCase()
        });
        return {
            code: 200,
            restaurants,
            message: "Restaurants fetched successfully",
        };

    } catch(err) {
        return {
            code: 500,
            restaurants: [],
            message: "Something went wrong!",
        };
    }
};

const postUploadUrl = async (args, user) => {
    if (!user) {
        return {
            code: 401,
            message: "Unauthorised"
        }
    }

    if (!args.count) {
        return {
            code: 400,
            message: "missing arguments"
        }
    }

    if (args._id && args.category === "claim") {
        try {
            const documents = await findVerificationRecords({
                restaurantId: ObjectId(args._id),
                userId: ObjectId(user.userId)
            });

            if(documents) {
                return {
                    code: 409,
                    message: "Records verification in progress",
                };
            }
        } catch(err) {
            throw new Error(err);
        }
    }

    try {
        let urlsPromiseList = [];
        for(let i=0; i<args.count; i++) {
            urlsPromiseList.push(putPresignedUrl({
                category: args.category
            }));
        }

        const urlsResult = await Promise.all(urlsPromiseList);

        return {
            code: 200,
            urls: urlsResult,
            message: 'Upload Url fetched successfully'
        }

    } catch(err) {
        return {
            code: 500,
            message: "Something went wrong!"
        }
    }
}

const addClaimDocuments = async (args, user) => {
    if (!user) {
        return {
            code: 401,
            message: "Unauthorised"
        }
    }

    if (!args._id || !args.documents.length) {
        return {
            code: 400,
            message: "missing arguments"
        }
    }

    try {
        const documents = await findVerificationRecords({
            restaurantId: ObjectId(args._id),
            userId: ObjectId(user.userId)
        });

        if(documents) {
            return {
                code: 409,
                message: "Records verification in progress",
            };
        }
    } catch(err) {
        throw new Error(err);
    }

    try {
        await addDocumentsVerification({
            userId: ObjectId(user.userId),
            restaurantId: ObjectId(args._id),
            documents: args.documents,
            status: "unclaimed"
        });
        return {
            code: 200,
            message: "Restaurants documents recorded",
        };
    } catch(err) {
        return {
            code: 500,
            message: "Something went wrong!",
        };
    }
};

const registerRestaurants = async (args, user) => {
    if (!user) {
        return {
            code: 401,
            message: "Unauthorised"
        }
    }

    const input = args.input;

    try {
        const documents = await findRestaurant({
            name: input.name.toLowerCase(),
            postalCode: input.postalCode,
            userId: ObjectId(user.userId)
        });

        if(documents) {
            return {
                code: 409,
                message: "Restaurant already registered.",
            };
        }
    } catch(err) {
        throw new Error(err);
    }

    try {
        const response = await registerRestaurantVerification({
            ...input,
            status: "unregistered",
            userId: ObjectId(user.userId),
            name: input.name.toLowerCase(),
            state: input.state.toLowerCase(),
            address: input.address.toLowerCase(),
            city: input.city.toLowerCase(),
            cuisines: input.cuisines.split(",")
                .filter((cuisine) => cuisine.trim().length > 0)
                .map((cuisine) => cuisine.trim())
        });
        return {
            code: 200,
            _id: response.insertedId.toString(),
            message: "Restaurants details recorded",
        };

    } catch(err) {
        return {
            code: 500,
            message: "Something went wrong!",
        };
    }
}

const restaurantRequests = async (args, user) => {
    if (!user) {
        return {
            code: 401,
            message: "Unauthorised"
        }
    }

    try {
        const claimRestaurantRequests = await findClaimRestaurantRequests({userId: ObjectId(user.userId)});
        const registerRestaurantRequests = await findRegisterRestaurantRequests({userId: ObjectId(user.userId)});

        let requestsData = [];
        let claimData = [];
        let registerData = [];

        if (claimRestaurantRequests.length) {
            claimData = claimRestaurantRequests.map((item) => ({
                type: "Claim",
                status: item.status,
                name: item.restaurant[0].name,
                address: item.restaurant[0].address,
                city: item.restaurant[0].city,
                state: item.restaurant[0].state,
                postalCode: item.restaurant[0].postalCode,
            }));
        }

        if (registerRestaurantRequests.length) {
            registerData = registerRestaurantRequests.map((item) => ({
                type: "Register",
                status: item.status,
                name: item.name,
                address: item.address,
                city: item.city,
                state: item.state,
                postalCode: item.postalCode,
            }));
        }
        requestsData = [
            ...claimData,
            ...registerData
        ];

        return {
            code: 200,
            restaurants: requestsData,
            message: "Requests fetched successfully",
        };

    } catch(err) {
        return {
            code: 500,
            message: "Something went wrong!",
        };
    }
};

const passwordResetLink = async (data, user) => {
    const {email} = data;

    if (!email) {
        return {
            code: 400,
            message: "Please enter your email"
        }
    }

    if (user) {
        return {
            code: 400,
            message: "User already logged in"
        }
    }

    const emailValidation = constants.emailRegex.test(email);
    if (!emailValidation) {
        return {
            code: 400,
            message: "Validation Failed"
        };
    }

    let userDetails;
    try {
        userDetails = await findUser({email});
        if (!userDetails) {
            return {
                code: 409,
                message: "No User registered with this email"
            };
        }
    } catch(err) {
        return {
            code: 500,
            message: "Something went wrong!",
        };
    }

    const resetPasswordToken = jwt.sign({
        data: {
            email,
            userId: userDetails._id,
        }
    }, constants.TOKEN_SECRET, { expiresIn: 60*30 });

    try {
        await sendEmail({
            to: email,
            templateId: constants.sendgrid_reset_password_template_id,
            args: {
                url: `https://snarkiapp.com/postforgotpassword/${resetPasswordToken}`
            }
        });

        return {
            code: 200,
            message: "Reset Password Email sent",
        };
    } catch(err) {
        return {
            code: 500,
            message: "Something went wrong!",
        };
    }
};

module.exports = {
    me,
    loginUser,
    registerUser,
    addClaimDocuments,
    contactSnarki,
    postUploadUrl,
    putPresignedUrl,
    getRestaurantsList,
    registerRestaurants,
    restaurantRequests,
    passwordResetLink
}
