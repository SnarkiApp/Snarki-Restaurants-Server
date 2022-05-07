const {ObjectId} = require('mongodb');
const {getDb} = require("../utils/mongo");

const findUser = async (args) => {
    return await getDb().collection("users").findOne({...args});
}

const addUser = async args => {
    await getDb().collection("users").insertOne({...args});
}

const updateUser = async ({matchArgs, updatedData}) => {
    await getDb().collection("users")
        .updateOne({...matchArgs}, {
            "$set": {
                ...updatedData
            }
        });
}

const getRestaurants = async ({searchText}) => {
    return await getDb().collection("restaurants")
        .aggregate([
            {
                $search: {
                    'text': {
                        'query': searchText,
                        'path': "name",
                    },
                },
            },
            { $match : { claimed : false } },
        ]).sort({score: {$meta: 'textScore'}})
        .toArray();
}

const findVerificationRecords = async (filters) => {
    return await getDb().collection("claim_restaurant_verification")
        .findOne(filters);
}

const addDocumentsVerification = async (filters) => {
    return await getDb().collection("claim_restaurant_verification")
        .insertOne(filters);
}

const addRestaurantDocuments = async ({restaurantId, documents}) => {
    return await getDb().collection("restaurants")
        .updateOne({
            _id: ObjectId(restaurantId)
        }, {
            "$set": {
                documents
            }
        });
}

const findRestaurant = async (filters) => {
    return await getDb().collection("register_restaurant_verification")
        .findOne(filters);
}

const registerRestaurantVerification = async (restaurant) => {
    return await getDb().collection("register_restaurant_verification")
        .insertOne(restaurant);
}

const findClaimRestaurantRequests = async ({userId}) => {
    return await getDb().collection("claim_restaurant_verification")
        .aggregate([
            { $match : { userId } },
            {
                $lookup: {
                    from: "restaurants",
                    localField: "restaurantId",
                    foreignField: "_id",
                    as: "restaurant"
                }
            }
        ]).toArray();
}

const findRegisterRestaurantRequests = async ({userId}) => {
    return await getDb().collection("register_restaurant_verification")
        .find({userId})
        .toArray();
}

module.exports = {
    addUser,
    findUser,
    updateUser,
    getRestaurants,
    findRestaurant,
    findVerificationRecords,
    addRestaurantDocuments,
    addDocumentsVerification,
    registerRestaurantVerification,
    findClaimRestaurantRequests,
    findRegisterRestaurantRequests
};
