const { gql } = require('apollo-server-express');

const typeDefs = gql`
    enum Role {
        RESTAURANT
    }

    type Status {
        code: Int,
        message: String!
    }

    type Login {
        code: Int!,
        message: String!
        token: String
        meData: User
    }

    type User {
        email: String!
        verified: Boolean!
        role: String!
        status: String
    }

    type UserData {
        meData: User
        code: Int!,
        message: String!
    }

    type Location {
        type: String,
        coordinates: [Float!]!
    }

    type Restaurant {
        _id: String!
        name: String!
        address: String!
        city: String!
        state: String!
        postalCode: String!
        contact: String!
        hours: String!
        cuisines: [String!]!
        location: Location!
    }

    type RestaurantResult {
        code: Int!
        message: String!
        restaurants: [Restaurant]
    }

    type PostUploadUrlType {
        code: Int!
        message: String!
        urls: [String!]
    }

    input RestaurantInput {
        name: String!
        ein: String!
        address: String!
        city: String!
        state: String!
        postalCode: String!
        contact: String!
        hours: String!
        cuisines: String!
        longitude: Float!
        latitude: Float!
        documents: [String!]!
        images: [String!]!
    }

    type RestaurantRequest {
        name: String!
        address: String!
        city: String!
        state: String!
        postalCode: String!
        status: String!
        type: String!
        reason: String
        subscriptionStatus: String
        subscriptionId: String
        restaurantId: String
        endDate: String
    }

    type RestaurantRequestsType {
        code: Int!
        message: String!
        restaurants: [RestaurantRequest!]
    }

    type Subscription {
        code: Int!
        message: String!
        subscriptionId: String
        clientSecret: String
    }

    type BillingItemType {
        name: String!
        address: String!
        city: String!
        state: String!
        postalCode: String!
        paymentStatus: String
    }

    type BillingType {
        code: Int!
        message: String!
        billing: [BillingItemType!]
    }

    type CreateSessionType {
        code: Int!
        message: String!
        url: String
    }

    type Query {
        login(
            email: String!
            password: String!
        ): Login

        contact(
            email: String!
            firstName: String
            lastName: String
            comments: String!
        ): Status

        me: UserData

        getRestaurants(
            name: String!
        ): RestaurantResult

        postUploadUrl(
            _id: String
            count: Int!
            category: String!
        ): PostUploadUrlType

        restaurantRequests(
            billing: Boolean
        ): RestaurantRequestsType

        sendPasswordResetLink(
            email: String!
        ): Status

        getUserBilling: BillingType
    }

    type Mutation {
        register(
            email: String!,
            role: String!,
            password: String!
        ): Status

        addClaimDocuments(
            _id: String!
            ein: String!
            documents: [String!]!
        ): Status

        registerRestaurants(
            input: RestaurantInput!
        ): Status

        resetPassword(
            token: String!
            password: String!
        ): Status

        createSubscription(
            priceId: String!
            restaurant: String!
        ): Subscription

        createCustomerPortalSession: CreateSessionType
    }
`;

module.exports = typeDefs;