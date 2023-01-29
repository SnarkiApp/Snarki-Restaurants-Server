const {ObjectId} = require('mongodb');
const {
    findUser
} = require("../data/data");

const getUser = async ({ userId }) => {

    try {
        return await findUser({ _id: ObjectId(userId) });
    } catch (err) {
        console.log(err);
        throw new Error("Error while fetching user Data");
    }

}

module.exports = {
    getUser
};
