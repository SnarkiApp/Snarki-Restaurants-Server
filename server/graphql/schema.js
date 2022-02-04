const { gql } = require('apollo-server');

const typeDefs = gql`
    type Status {
        code: Int,
        message: String!
    }

    type loginType {
        code: Int,
        message: String!
    }

    type Query {
        login(
            email: String!
            password: String!
        ): loginType

        contact(
            email: String!
            firstName: String
            lastName: String
            comments: String!
        ): Status
    }

    type Mutation {
        register(
            email: String!,
            password: String!
        ): Status
    }
`;

module.exports = typeDefs;