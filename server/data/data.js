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
        .find({"name": {"$regex": `^${searchText}`}})
        .toArray();
}

const findVerificationRecords = async ({restaurantId}) => {
    return await getDb().collection("restaurant_verification").findOne({_id: restaurantId});
}

const addDocumentsVerification = async ({restaurantId, documents}) => {
    return await getDb().collection("restaurant_verification")
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

module.exports = {
    addUser,
    findUser,
    getRestaurants,
    findVerificationRecords,
    addRestaurantDocuments,
    addDocumentsVerification
};
