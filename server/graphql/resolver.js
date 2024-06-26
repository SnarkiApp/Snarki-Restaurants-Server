const _ = require("lodash");
const {ObjectId} = require('mongodb');
const jwt = require('jsonwebtoken');
const {
    findUser,
    addUser,
    updateUser,
    getRestaurants,
    validateClaimRequest,
    addDocumentsVerification,
    findClaimRestaurantRequests,
    registerRestaurantVerification,
    findRegisterRestaurantRequests
} = require("../data/data");
const {hashPassword, comparePassword} = require("../utils/bcrypt");
const constants = require("../utils/constants");
const { sendEmail } = require("../utils/sendEmail");
const { putPresignedUrl } = require("../utils/aws/preSignedUrl");
const types = require("../utils/types");

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
            setReplyTo: email,
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

        const formattedRestaurants = restaurants.map((restaurant) => ({
            _id: restaurant._id,
            name: restaurant.name,
            address: restaurant.address,
            city: restaurant.city,
            state: restaurant.state,
            postalCode: restaurant.postalCode,
            contact: restaurant.contact,
            hours: restaurant.hours,
            cuisines: restaurant.cuisines,
            location: restaurant.location
        }));
        return {
            code: 200,
            restaurants: formattedRestaurants,
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
            message: "Url count missing"
        }
    }

    if (args.category === "claim") {

        if (!args._id) {
            return {
                code: 400,
                message: "Restaurant Id missing"
            }
        }

        try {
            const restaurantStatus = await validateClaimRequest({
                restaurantId: ObjectId(args._id),
                userId: ObjectId(user.userId),
                restaurantStatus: [
                    types["Status"]["UNCLAIMED"],
                    types["Status"]["APPROVED"]
                ]
            });
            
            for(let i=0; i<restaurantStatus.length; i++) {

                if(restaurantStatus[i] != null) {

                    if (restaurantStatus[i].status == "approved") {
                        return {
                            code: 409,
                            message: "Restaurant already claimed",
                        };
                    } else {
                        return {
                            code: 409,
                            message: "Records verification in progress",
                        };
                    }

                }

            };
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

    if (!args._id || !args.ein || !args.documents.length) {
        return {
            code: 400,
            message: "missing arguments"
        }
    }

    try {
        const restaurantStatus = await validateClaimRequest({
            restaurantId: ObjectId(args._id),
            userId: ObjectId(user.userId),
            restaurantStatus: [
                types["Status"]["UNCLAIMED"],
                types["Status"]["APPROVED"]
            ]
        });

        for(let i=0; i<restaurantStatus.length; i++) {

            if (restaurantStatus[i].status == types["Status"]["APPROVED"]) {
                return {
                    code: 409,
                    message: "Restaurant already claimed. Please contact support.",
                };
            } else {
                return {
                    code: 409,
                    message: "Records verification in progress",
                };
            }

        };
    } catch(err) {
        throw new Error(err);
    }

    try {
        await addDocumentsVerification({
            userId: ObjectId(user.userId),
            restaurantId: ObjectId(args._id),
            documents: args.documents,
            ein: args.ein,
            status: types["Status"]["UNCLAIMED"]
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

    // try {
    //     /*
    //         Block registration if restaurant
    //         with same name and postalcode
    //         by same user.
    //     */
    //     const documents = await findRegisteredRestaurant({
    //         name: input.name.toLowerCase(),
    //         postalCode: input.postalCode,
    //         userId: ObjectId(user.userId)
    //     });

    //     if(documents) {
    //         return {
    //             code: 409,
    //             message: "Restaurant already registered.",
    //         };
    //     }
    // } catch(err) {
    //     throw new Error(err);
    // }

    try {
        await registerRestaurantVerification({
            status: types["Status"]["UNREGISTERED"],
            userId: ObjectId(user.userId),
            ein: input.ein.trim().toLowerCase(),
            name: input.name.trim().toLowerCase(),
            state: input.state.trim().toLowerCase(),
            address: input.address.trim().toLowerCase(),
            city: input.city.trim().toLowerCase(),
            contact: input.contact.trim(),
            postalCode: input.postalCode.trim(),
            hours: input.hours.trim().toLowerCase(),
            location: {
                type: "Point",
                coordinates: [
                    input.longitude,
                    input.latitude
                ]
            },
            documents: input.documents,
            images: input.images,
            cuisines: input.cuisines.split(",")
                .filter((cuisine) => cuisine.trim().length > 0)
                .map((cuisine) => cuisine.trim())
        });
        return {
            code: 200,
            message: "Request registered successfully",
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
                reason: item.restaurant[0].reason ?? ""
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
                reason: item.reason ?? ""
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

const resetUserPassword = async (data, user) => {
    const {token, password} = data;

    if (!token) {
        return {
            code: 400,
            message: "This Link has Expired. Please try again."
        }
    }

    if (!password) {
        return {
            code: 400,
            message: "Password cannot be empty"
        }
    }

    if (user) {
        return {
            code: 400,
            message: "User already logged in"
        }
    }

    if (password.length < 10) {
        return {
            code: 400,
            message: "Validation Failed"
        };
    }

    let tokenData;
    try {
        const { data } = await jwt.verify(token, constants.TOKEN_SECRET);
        tokenData = data;

        if (!tokenData.userId || !tokenData.email) {
            throw new Error();
        }
    } catch(err) {
        return {
            code: 500,
            message: "This Link has Expired. Please try again.",
        };
    }

    let userDetails;
    try {
        userDetails = await findUser({email: tokenData.email});
        if (!userDetails) {
            return {
                code: 409,
                message: "User not found. Please try again"
            };
        }
    } catch(err) {
        return {
            code: 500,
            message: "Something went wrong!",
        };
    }

    let securePassword;
    try {
        securePassword = await hashPassword(password);
    } catch(err) {
        throw new Error(err);
    }

    try {
        await updateUser({
            matchArgs: {
                _id: ObjectId(tokenData.userId)
            },
            updatedData: {
                password: securePassword
            }
        });

        return {
            code: 200,
            message: "Password Updated Successfully",
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
    passwordResetLink,
    resetUserPassword
}
