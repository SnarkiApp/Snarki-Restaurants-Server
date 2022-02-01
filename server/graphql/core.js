const typeDefs = require("./schema");
const {
    registerUser
} = require("./resolver");

const resolvers = {
    Query: {},
    Mutation: {
        register: (_, args) => registerUser(args)
    }
};

const apolloData = {typeDefs, resolvers};

module.exports = {apolloData};