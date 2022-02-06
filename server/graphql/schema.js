const { gql } = require('apollo-server-express');

const typeDefs = gql`
    type Status {
        code: Int,
        message: String!
    }

    type Login {
        code: Int,
        message: String!
        token: String!
        meData: User
    }

    type User {
        email: String!
    }

    type UserData {
        meData: User
        code: Int,
        message: String!
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
    }

    type Mutation {
        register(
            email: String!,
            role: String!,
            password: String!
        ): Status
    }
`;

module.exports = typeDefs;