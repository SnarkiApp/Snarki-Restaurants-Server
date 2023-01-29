const _ = require("lodash");
const {ObjectId} = require('mongodb');
const jwt = require('jsonwebtoken');
const {
    findUser,
    addUser,
    updateUser,
    getRestaurants,
    updateRestaurant,
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
const { getCustomerRestaurantPayment } = require("./Stripe/resolver");

const registerUser = async data => {
    const {email, password, role} = data;

    if (!email || !password || !role) {
        return {
            code: 400,
            message: "missing email or password"
        }
    }

    if (role != "RESTAURANT") {
        throw new Error("registerUser: Invalid Role");
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
            message: "missing email or password"
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
            message: "missing email"
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

        const paymentDetails = userDetails.stripe ?? null;
        
        delete userDetails.password;
        if (paymentDetails != null) {
            delete userDetails.stripe;
        }

        const response = {
            code: 200,
            meData: {
                ...userDetails
            },
            message: "User details fetched successfully",
        };

        if (paymentDetails) {
            response["meData"]["status"] = paymentDetails.status;
        }

        return response;

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
        throw new Error("postUploadUrl: Url Count arg missing");
    }

    if (args.category === "claim") {

        if (!args._id) {
            throw new Error("postUploadUrl: claim restaurant id missing");
        }

        try {
            const restaurantStatus = await validateClaimRequest({
                restaurantId: ObjectId(args._id),
                userId: ObjectId(user.userId),
                restaurantStatus: [
                    types["STATUS"]["UNCLAIMED"],
                    types["STATUS"]["APPROVED"]
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
        throw new Error("addClaimDocuments: missing arguments");
    }

    try {
        const restaurantStatus = await validateClaimRequest({
            restaurantId: ObjectId(args._id),
            userId: ObjectId(user.userId),
            restaurantStatus: [
                types["STATUS"]["UNCLAIMED"],
                types["STATUS"]["APPROVED"]
            ]
        });

        for(let i=0; i<restaurantStatus.length; i++) {

            if (restaurantStatus[i].status == types["STATUS"]["APPROVED"]) {
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
            status: types["STATUS"]["UNCLAIMED"]
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
            status: types["STATUS"]["UNREGISTERED"],
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

    let userRestaurantPaymentInfo = [];
    const restaurantStripeMap = {};
    const getBillingDetails = "billing" in args && args["billing"];

    if (getBillingDetails) {
        try {
            userRestaurantPaymentInfo = await getCustomerRestaurantPayment({
                userId: ObjectId(user.userId)
            }, true);
        } catch(err) {
            throw new Error("restaurantRequests: Error while fetching customer restaurant payment details");
        }

        for(let i=0; i<userRestaurantPaymentInfo.length; i++) {
            const restaurant = (userRestaurantPaymentInfo[i].restaurant).toString();
            restaurantStripeMap[restaurant] = userRestaurantPaymentInfo[i];
        }
    }

    try {
        const requests = await Promise.all([
            findClaimRestaurantRequests({userId: ObjectId(user.userId)}),
            findRegisterRestaurantRequests({userId: ObjectId(user.userId)})
        ]);

        const claimRequests = requests.filter(obj => "claim" in obj)[0].claim;
        const registerRequests = requests.filter(obj => "register" in obj)[0].register;

        let requestsData = [];
        for(let i=0; i<claimRequests.length; i++) {

            if (getBillingDetails && claimRequests[i].status != types["STATUS"]["APPROVED"]) continue;

            requestsData.push({
                type: "Claim",
                status: claimRequests[i].status,
                name: claimRequests[i].restaurant[0].name,
                address: claimRequests[i].restaurant[0].address,
                city: claimRequests[i].restaurant[0].city,
                state: claimRequests[i].restaurant[0].state,
                postalCode: claimRequests[i].restaurant[0].postalCode,
                reason: claimRequests[i].restaurant[0].reason ?? "",
                restaurantId: claimRequests[i].restaurantId,
            });
            
            if (getBillingDetails) {
                if (restaurantStripeMap[claimRequests[i]["restaurantId"]] && "restaurant" in restaurantStripeMap[claimRequests[i]["restaurantId"].toString()]) {
                    const paymentDetails = restaurantStripeMap[claimRequests[i]["restaurantId"].toString()];
                    requestsData[requestsData.length-1]["subscriptionStatus"] = paymentDetails["subscriptionStatus"];
                    requestsData[requestsData.length-1]["subscriptionId"] = paymentDetails["subscription"];
                    requestsData[requestsData.length-1]["endDate"] = paymentDetails["subscriptionStatus"] == "active" ? paymentDetails["endDate"] : null;
                }
            }

        }

        for(let i=0; i<registerRequests.length; i++) {

            if (getBillingDetails && registerRequests[i].status != types["STATUS"]["APPROVED"]) continue;

            requestsData.push({
                type: "Register",
                status: registerRequests[i].status,
                name: registerRequests[i].name,
                address: registerRequests[i].address,
                city: registerRequests[i].city,
                state: registerRequests[i].state,
                postalCode: registerRequests[i].postalCode,
                reason: registerRequests[i].reason ?? "",
                restaurantId: registerRequests[i].restaurantId
            });
            
            if (getBillingDetails) {
                if (restaurantStripeMap[registerRequests[i]["restaurantId"]] && "restaurant" in restaurantStripeMap[registerRequests[i]["restaurantId"].toString()]) {
                    const paymentDetails = restaurantStripeMap[registerRequests[i]["restaurantId"].toString()];
                    requestsData[requestsData.length-1]["subscriptionStatus"] = paymentDetails["subscriptionStatus"];
                    requestsData[requestsData.length-1]["subscriptionId"] = paymentDetails["subscription"];
                    requestsData[requestsData.length-1]["endDate"] = paymentDetails["subscriptionStatus"] == "active" ? paymentDetails["endDate"] : null;
                }
            }

        }

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

const updateUserData = async ({ matchArgs, updatedData }) => {

    try {
        await updateUser({
            matchArgs,
            updatedData
        });
    } catch (err) {
        throw new Error("Error while fetching user Data");
    }

}

const updateRestaurantData = async ({ matchArgs, updatedData }) => {

    try {
        await updateRestaurant({
            matchArgs,
            updatedData
        });
    } catch (err) {
        throw new Error("Error while updating restaurant data");
    }

}

module.exports = {
    me,
    loginUser,
    registerUser,
    updateUserData,
    updateRestaurantData,
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
