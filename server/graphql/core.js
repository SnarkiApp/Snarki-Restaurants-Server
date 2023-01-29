const typeDefs = require("./schema");
const {
    me,
    loginUser,
    registerUser,
    addClaimDocuments,
    contactSnarki,
    postUploadUrl,
    getRestaurantsList,
    registerRestaurants,
    restaurantRequests,
    passwordResetLink,
    resetUserPassword
} = require("./resolver");
const {
    createUserSubscription,
    createPortalSession
} = require("./Stripe/resolver");

const resolvers = {
    Query: {
        contact: (_, args) => contactSnarki(args),
        login: (_, args, {res}) => loginUser(args, res),
        me: (_, args, {user}) => me(user),
        getRestaurants: (_, args, {user}) => getRestaurantsList(args, user),
        postUploadUrl: (_, args, {user}) => postUploadUrl(args, user),
        restaurantRequests: (_, args, {user}) => restaurantRequests(args, user),
        sendPasswordResetLink: (_, args, {user}) => passwordResetLink(args, user),
    },
    Mutation: {
        register: (_, args) => registerUser(args),
        addClaimDocuments: (_, args, {user}) => addClaimDocuments(args, user),
        registerRestaurants: (_, args, {user}) => registerRestaurants(args, user),
        resetPassword: (_, args, {user}) => resetUserPassword(args, user),
        createSubscription: (_, args, {user}) => createUserSubscription(args, user),
        createCustomerPortalSession: (_, args, {user}) => createPortalSession(user),
    }
};

const apolloData = {typeDefs, resolvers};

module.exports = {apolloData};