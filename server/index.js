const express = require('express');
const jwt = require('jsonwebtoken');
const {ApolloServer} = require('apollo-server-express');
const {apolloData} = require("./graphql/core");
const {connectToMongoServer} = require('./utils/mongo');
const cookieParser = require("cookie-parser");
const bodyParser = require('body-parser');
const constants = require("./utils/constants");

const app = express();
const corsOptions = {
    origin: 'http://localhost:3000',
    credentials: true
}
app.use(bodyParser.json());
app.use(cookieParser());

const startServer = async () => {
    const server = new ApolloServer({
        ...apolloData,
        context: async ({ req, res }) => {
            const token = req.headers.authorization || "";

            let user = null;
            if (token) {
                try {
                    const { data: tokenData } = await jwt.verify(token, constants.TOKEN_SECRET);

                    // TODO: Search for user in DB
                    user = tokenData;
                } catch(err) {
                    console.log(err);
                }
            }
         
            return { req, res, user };
          },
    });

    await server.start();
    server.applyMiddleware({ app, cors: corsOptions });

    app.listen({ port: 4000 }, () =>
        console.log(`Server ready at port 4000`) 
    );
}

connectToMongoServer()
    .then(async () => await startServer())
    .catch(err => {
        throw new Error(err)
    });
