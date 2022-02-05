const typeDefs = require("./schema");
const {
    me,
    loginUser,
    registerUser,
    contactSnarki
} = require("./resolver");

const resolvers = {
    Query: {
        contact: (_, args) => contactSnarki(args),
        login: (_, args, {res}) => loginUser(args, res),
        me: (_, args, {user}) => me(user)
    },
    Mutation: {
        register: (_, args) => registerUser(args)
    }
};

const apolloData = {typeDefs, resolvers};

module.exports = {apolloData};