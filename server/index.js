const {ApolloServer} = require('apollo-server');
const {apolloData} = require("./graphql/core");
const {connectToMongoServer} = require('./utils/mongo');

connectToMongoServer()
    .then(() => {
        const server = new ApolloServer({ ...apolloData });
        server.listen().then(({ url }) => {
            console.log(`Server ready at ${url}`);
        });
    }).catch(err => {
        throw new Error(err)
    });
