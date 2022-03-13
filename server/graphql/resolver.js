const _ = require("lodash");
const jwt = require('jsonwebtoken');
const {
    findUser,
    addUser,
    getRestaurants,
    findRestaurant,
    findVerificationRecords,
    addDocumentsVerification,
    registerRestaurantVerification
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
                _id: args._id
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
            _id: args._id,
            userId: user.userId
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
            userId: user.userId,
            restaurantId: args._id,
            documents: args.documents
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
            postalCode: input.postalCode
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
            name: input.name.toLowerCase(),
            state: input.state.toLowerCase(),
            address: input.address.toLowerCase(),
            city: input.city.toLowerCase()
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

module.exports = {
    me,
    loginUser,
    registerUser,
    addClaimDocuments,
    contactSnarki,
    postUploadUrl,
    putPresignedUrl,
    getRestaurantsList,
    registerRestaurants
}
