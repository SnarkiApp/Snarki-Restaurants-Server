const { gql } = require('apollo-server');

const typeDefs = gql`
    type Status {
        code: Int,
        message: String!
    }

    type Query {
        a: String
    }

    type Mutation {
        register(
            email: String!,
            password: String!
        ): Status
    }
`;

module.exports = typeDefs;