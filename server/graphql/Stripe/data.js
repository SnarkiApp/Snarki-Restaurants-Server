const {ObjectId} = require('mongodb');
const {getDb} = require("../../utils/mongo");

const updateCustomerStripe = async (
    filters,
    updatedData
) => {

    if ("restaurant" in filters) {
        filters.restaurant = new ObjectId(filters.restaurant);
    }

    const response = await getDb().collection("stripe")
        .findOneAndUpdate(
            {...filters},
            {
                $set: {...updatedData}
            },
            { upsert: true, returnDocument: "after" }
        );
    
    return response.value;
}

const getCustomerRestaurantPaymentInfo = async (userId) => {

    userId = ObjectId(userId);
    return await getDb().collection("stripe")
        .find({ user: userId })
        .toArray();

}

const findSubscription = async (filters) => {

    if ("restaurant" in filters) {
        filters["restaurant"] = ObjectId(filters["restaurant"]);
    }

    if ("user" in filters) {
        filters["user"] = ObjectId(filters["user"]);
    }

    return await getDb().collection("stripe")
        .find(filters)
        .toArray();

}

module.exports = {
    findSubscription,
    updateCustomerStripe,
    getCustomerRestaurantPaymentInfo
}
