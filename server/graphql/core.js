const typeDefs = require("./schema");
const {
    me,
    loginUser,
    registerUser,
    addDocuments,
    contactSnarki,
    postUploadUrl,
    getRestaurantsList,
} = require("./resolver");

const resolvers = {
    Query: {
        contact: (_, args) => contactSnarki(args),
        login: (_, args, {res}) => loginUser(args, res),
        me: (_, args, {user}) => me(user),
        getRestaurants: (_, args, {user}) => getRestaurantsList(args, user),
        postUploadUrl: (_, args, {user}) => postUploadUrl(args, user)
    },
    Mutation: {
        register: (_, args) => registerUser(args),
        addDocuments: (_, args, {user}) => addDocuments(args, user)
    }
};

const apolloData = {typeDefs, resolvers};

module.exports = {apolloData};