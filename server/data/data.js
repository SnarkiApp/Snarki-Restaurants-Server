const {getDb} = require("../utils/mongo");

const findUser = async (args) => {
    return await getDb().collection("users").findOne({...args});
}

const addUser = async args => {
    await getDb().collection("users").insertOne({...args});
}

module.exports = {
    addUser,
    findUser
};
