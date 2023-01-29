const { ObjectId } = require("mongodb");
const { updateRestaurantData, updateUserData } = require("../resolver");
const { updateCustomerStripeStatus } = require("./resolver");

const stripe = require('stripe')('sk_test_51KuQTfEENlNwB06RNvE2rjh5aAioZmHbzLDSQLLakQv67b7pqTMoq1XtqWDueaDQdUaLtpo14sbR7pNVNA4W0hrJ00oWI3wyar');

const stripeWebhookHandler = async (req, res) => {

    // Retrieve the event by verifying the signature using the raw body and secret.
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            req.headers['stripe-signature'],
            "whsec_uFaVel5HKViGjipVgiDwRobwV97YsI95"
        );
    } catch (err) {
        console.log(err);
        console.log(`⚠️  Webhook signature verification failed.`);
        console.log(
            `⚠️  Check the env file and enter the correct webhook secret.`
        );
        return res.sendStatus(400);
    }

    const dataObject = event.data.object;

    switch (event.type) {
        case 'invoice.paid':
            if (dataObject.status == "paid") {
                const subscription = await stripe.subscriptions.retrieve(
                    dataObject.subscription
                );
                
                let stripeUpdateResponse = null;
                try {
                    stripeUpdateResponse = await updateCustomerStripeStatus({
                        filters: {
                            restaurant: subscription.metadata.restaurant
                        },
                        updatedData: {
                            user: ObjectId(subscription.metadata.user),
                            customer: dataObject.customer,
                            subscription: dataObject.subscription,
                            restaurant: ObjectId(subscription.metadata.restaurant),
                            status: dataObject.status,
                            priceId: subscription.plan.id,
                        }
                    });
                } catch(err) {
                    throw new Error("invoice.paid: Error updating customer stripe payment details");
                }

                try {
                    await Promise.all([
                        updateUserData({
                            matchArgs: {
                                _id: ObjectId(subscription.metadata.user)
                            },
                            updatedData: {
                                verified: true,
                                customer: dataObject.customer
                            }
                        }),
                        updateRestaurantData({
                            matchArgs: {
                                _id: ObjectId(subscription.metadata.restaurant)
                            },
                            updatedData: {
                                premium: true,
                                paymentId: stripeUpdateResponse._id
                            }
                        })
                    ]);
                } catch(err) {
                    throw new Error("invoice.paid: Error while updating restaurant status");
                }
            }
            break;
        case 'invoice.payment_failed':
            // If the payment fails or the customer does not have a valid payment method,
            //  an invoice.payment_failed event is sent, the subscription becomes past_due.
            // Use this webhook to notify your user that their payment has
            // failed and to retrieve new card details.
            break;
        case 'invoice.payment_succeeded':
            //
            //

            // TODO: check duplicate payment methods
            // TODO: update payment method via portal should reflect inside subscription in website

            //

            //
            if (dataObject['billing_reason'] == 'subscription_create') {
                const subscription_id = dataObject['subscription'];
                const payment_intent_id = dataObject['payment_intent'];
              
                // Retrieve the payment intent used to pay the subscription
                const payment_intent = await stripe.paymentIntents.retrieve(payment_intent_id);
                // console.log(dataObject);
                // const a = await stripe.subscriptions.retrieve(
                //     subscription_id
                // );
              
                await stripe.subscriptions.update(
                  subscription_id,
                  {
                    default_payment_method: payment_intent.payment_method,
                  },
                );
            };
            break;
        case 'customer.subscription.deleted':
            let stripeUpdateResponse = null;
            try {
                stripeUpdateResponse = await updateCustomerStripeStatus({
                    filters: {
                        customer: dataObject.customer,
                        priceId: dataObject.plan.id,
                        subscription: dataObject.id,
                        restaurant: dataObject.metadata.restaurant
                    },
                    updatedData: {
                        status: dataObject.status
                    }
                });
            } catch(err) {
                throw new Error("customer.subscription.deleted: Error updating customer stripe payment details");
            }

            try {
                updateRestaurantData({
                    matchArgs: {
                        _id: ObjectId(dataObject.metadata.restaurant)
                    },
                    updatedData: {
                        premium: false,
                        paymentId: null
                    }
                });
            } catch(err) {
                throw new Error("customer.subscription.deleted: Error while updating restaurant status")
            }

            break;
        default:
            break;
    }

}

module.exports = {
    stripeWebhookHandler
};
