const typeDefs = require("./schema");
const {
    loginUser,
    registerUser,
    contactSnarki
} = require("./resolver");

const resolvers = {
    Query: {
        login: (_, args, {res}) => loginUser(args, res),
        contact: (_, args) => contactSnarki(args)
    },
    Mutation: {
        register: (_, args) => registerUser(args)
    }
};

const apolloData = {typeDefs, resolvers};

module.exports = {apolloData};