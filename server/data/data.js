const {ObjectId} = require('mongodb');
const {getDb} = require("../utils/mongo");

const findUser = async (args) => {
    return await getDb().collection("users").findOne({...args});
}

const addUser = async args => {
    await getDb().collection("users").insertOne({...args});
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

const addDocumentsVerification = async ({restaurantId, documents}) => {
    return await getDb().collection("claim_restaurant_verification")
        .insertOne({
            _id: restaurantId,
            documents
        });
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

module.exports = {
    addUser,
    findUser,
    getRestaurants,
    findRestaurant,
    findVerificationRecords,
    addRestaurantDocuments,
    addDocumentsVerification,
    registerRestaurantVerification
};
