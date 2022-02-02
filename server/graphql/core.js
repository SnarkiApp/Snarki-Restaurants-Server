const typeDefs = require("./schema");
const {
    loginUser,
    registerUser
} = require("./resolver");

const resolvers = {
    Query: {
        login: (_, args) => loginUser(args)
    },
    Mutation: {
        register: (_, args) => registerUser(args)
    }
};

const apolloData = {typeDefs, resolvers};

module.exports = {apolloData};