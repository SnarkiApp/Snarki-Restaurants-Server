const { getUser } = require("../userUtils");
const {
    findSubscription,
    updateCustomerStripe,
    getCustomerRestaurantPaymentInfo
} = require("./data");
const { STRIPE_STATUS } = require("../../utils/types");

const stripe = require('stripe')('sk_test_51KuQTfEENlNwB06RNvE2rjh5aAioZmHbzLDSQLLakQv67b7pqTMoq1XtqWDueaDQdUaLtpo14sbR7pNVNA4W0hrJ00oWI3wyar');

const createCustomer = async ({email = ""}) => {

    if (!email) return;

    try {
        return await stripe.customers.create({
            email
        });
    } catch (err) {
        throw new Error("Error creating new customer.");
    }
}

const updateCustomerStripeStatus = async ({
    filters = {},
    updatedData = {}
}) => {

    if (!Object.keys(filters).length) {
        throw new Error("updateCustomerStripeStatus: filters cannot be empty");
    };
    if (!Object.keys(updatedData).length) {
        throw new Error("updateCustomerStripeStatus: Customer Restaurant Stripe Data cannont be empty.");
    }

    try {
        return await updateCustomerStripe(filters, updatedData);
    } catch (err) {
        throw new Error("Error updating stripe customer record.");
    }
}

const findCustomerSubscription = async (filters = {}) => {

    if (!Object.keys(filters).length) {
        throw new Error("filters cannot be empty.");
    }

    try {
        return await findSubscription(filters);
    } catch (err) {
        throw new Error("Error fetching restaurant sucbscription details");
    }

}

const createUserSubscription = async ({priceId, restaurant}, user) => {
    if (!user) {
        return {
            code: 400,
            message: "User login required."
        };
    }

    if (!restaurant || !priceId) {
        return {
            code: 400,
            message: "Invalid Link"
        };
    }

    let customerId = null;
    let dbCustomer = {};
    try {
        dbCustomer = await getUser(user);
        customerId = "customer" in dbCustomer ? dbCustomer.customer : null;
    } catch (err) {
        return {
            code: 500,
            message: "Error fetching logged in user data."
        };
    }

    // if customerId already exists in DB
    // fetch and return subscription for this customer id instead of creating new one!!!
    if (!customerId) {
        try {
            const customer = await createCustomer({
                email: dbCustomer.email
            });
            customerId = customer.id;
        } catch(err) {
            throw new Error("Error creating new customer");
        }
    }

    try {
        const customerRestaurantSubscriptionExists = await findCustomerSubscription({
            priceId,
            restaurant,
            user: user.userId,
            status: STRIPE_STATUS.PAID,
        });

        if (customerRestaurantSubscriptionExists.length) {
            return {
                code: 400,
                message: "A subscription for this restaurant with same plan in PAID status exists. Please reach out to support for more."
            }
        }
    } catch(err) {
        throw new Error("Error fetching checking duplicate subscription details.")
    }

    const subscriptionOptions = {
        customer: customerId,
        items: [{
          price: priceId,
        }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
        metadata: {
            restaurant,
            user: user.userId
        },
    };

    try {
        const subscription = await stripe.subscriptions.create(subscriptionOptions);

        return {
            code: 200,
            message: "Subscription started successfully!",
            subscriptionId: subscription.id,
            clientSecret: subscription.latest_invoice.payment_intent.client_secret,
        };
    } catch (err) {
        return {
            code: 400,
            message: "Something went wrong!"
        }
    }
};

const getCustomerRestaurantPayment = async ({userId = ""}, getSubscriptionDetails = false) => {
    if (!userId) throw new Error("User not found!");

    let paymentInfo = [];
    try {
        paymentInfo = await getCustomerRestaurantPaymentInfo(userId);
    } catch(err) {
        throw new Error("Error fetching customer restaurant payment status");
    }

    if (getSubscriptionDetails) {
        const subscriptionPromiseList = [];
        for(let i=0; i<paymentInfo.length; i++) {
            subscriptionPromiseList.push(
                stripe.subscriptions.retrieve(
                    paymentInfo[i].subscription
                )
            );
        }

        const subscriptionData = await Promise.all(subscriptionPromiseList);
        const subscriptionIdDataMap = {};
        for(let i=0; i<subscriptionData.length; i++) {
            subscriptionIdDataMap[subscriptionData[i]["id"]] = {
                "endDate": new Date(subscriptionData[i]["current_period_end"] * 1000).toLocaleString(),
                "subscriptionStatus": subscriptionData[i]["status"]
            };
        }

        for(let i=0; i<paymentInfo.length; i++) {
            paymentInfo[i] = {
                ...paymentInfo[i],
                ...subscriptionIdDataMap[paymentInfo[i]["subscription"]]
            };
        }
    }

    return paymentInfo;
}

const createPortalSession = async (user) => {
    if (!user) {
        return {
            code: 400,
            message: "User login required."
        };
    }

    let dbUser = {};
    try {
        dbUser = await getUser(user);
    } catch(err) {
        throw new Error("Error fetching user details, customer portal session");
    }

    if (!dbUser.customer) {
        throw new Error("Customer Id missing while creating portal session");
    }

    let session;
    try {
        // UPDATE RETURN URL
        session = await stripe.billingPortal.sessions.create({
            customer: dbUser.customer,
            return_url: 'http://localhost:3000/dashboard/billing',
        });
    } catch(err) {
        throw new Error("Error creating customer portal session");
    }
    
    return {
        code: 200,
        url: session.url,
        message: "Customer Portal session created successfully.",
    };

}

module.exports = {
    createUserSubscription,
    updateCustomerStripeStatus,
    getCustomerRestaurantPayment,
    createPortalSession
};
