import Stripe from "stripe"

export interface Subscription extends Stripe.Subscription {}

export const stripeApiClient = new Stripe(`${process.env.STRIPE_SECRET_KEY}`, {
	apiVersion: "2020-08-27",
})

export interface CustomerHasFeatureArgs {
	customerId: string
	feature: string
}
export const customerHasFeature = async ({
	customerId,
	feature,
}: CustomerHasFeatureArgs) => {
	const customer = (await stripeApiClient.customers.retrieve(customerId, {
		expand: ["subscriptions"],
	})) as Stripe.Customer
	let subscription: Stripe.Subscription | null = customer.subscriptions
		? customer.subscriptions.data[0] || null
		: null
	if (subscription) {
		subscription = await stripeApiClient.subscriptions.retrieve(
			subscription.id,
			{ expand: ["items.data.price.product"] }
		)
		const features = (
			subscription.items.data[0].price.product as Stripe.Product
		).metadata.features
		return features?.includes(feature)
	}
	return false
}

export interface SubscriptionHandlerArgs {
	customerId: string
	query: {
		action: string
	}
	body: any
}
export const subscriptionHandler = async ({
	customerId,
	query,
	body,
}: SubscriptionHandlerArgs) => {
	if (query.action === "useSubscription") {
		return await useSubscription({ customerId })
	}

	if (query.action === "redirectToCheckout") {
		return await redirectToCheckout({ customerId, body })
	}

	if (query.action === "redirectToCustomerPortal") {
		return await redirectToCustomerPortal({ customerId, body })
	}

	return { error: "Action not found" }
}

export interface UseSubscriptionArgs {
	customerId: string
}
async function useSubscription({ customerId }: UseSubscriptionArgs) {
	// Retrieve products based on default billing portal config

	// First, retrieve the configuration
	const configurations =
		await stripeApiClient.billingPortal.configurations.list({
			is_default: true,
			expand: ["data.features.subscription_update.products"],
		})
	if (!configurations) return null

	// Stripe doesn't let us expand as much as we'd like.
	// Run this big mess to manually expand

	//  configurations.data[0].features.subscription_update.products.length;

	// We preserve the order stripe returns things in
	const products = new Array(
		configurations.data[0].features.subscription_update.products?.length
	)
	const pricePromises = (
		configurations.data[0].features.subscription_update.products || []
	)
		.map((product, i) =>
			product.prices.map(async (price, j) => {
				const priceData = await stripeApiClient.prices.retrieve(price, {
					expand: ["product"],
				})
				const cleanPriceData = {
					...priceData,
					product: (priceData.product as Stripe.Product).id,
				}
				if (!products[i]) {
					products[i] = {
						product: priceData.product,
						prices: new Array(product.prices.length),
					}
					products[i].prices[j] = cleanPriceData
				} else {
					products[i].prices[j] = cleanPriceData
				}
			})
		)
		.flat()

	let subscription: Stripe.Subscription | null = null
	const subscriptionPromise = new Promise<void>(async (resolve) => {
		const customer: any = await stripeApiClient.customers.retrieve(customerId, {
			expand: ["subscriptions"],
		})
		subscription = customer.subscriptions.data[0] || null
		if (subscription) {
			subscription = await stripeApiClient.subscriptions.retrieve(
				subscription.id,
				{
					expand: ["plan.product"],
				}
			)
		}
		resolve()
	})

	await Promise.all([...pricePromises, subscriptionPromise])

	return { products, subscription }
}

export interface RedirectArgs {
	customerId: string
	body: any
}
async function redirectToCustomerPortal({ customerId, body }: RedirectArgs) {
	return await stripeApiClient.billingPortal.sessions.create({
		customer: customerId,
		return_url: body.returnUrl,
	})
}

async function redirectToCheckout({ customerId, body }: RedirectArgs) {
	const configurations =
		await stripeApiClient.billingPortal.configurations.list({
			is_default: true,
			expand: ["data.features.subscription_update.products"],
		})

	// Make sure the price ID is in here somewhere
	let go = false
	for (let product of configurations.data[0].features.subscription_update
		.products || []) {
		for (let price of product.prices) {
			if (price === body.price) {
				go = true
				break
			}
		}
	}

	if (go) {
		return await stripeApiClient.checkout.sessions.create({
			customer: customerId,
			success_url: body.successUrl,
			cancel_url: body.cancelUrl,
			line_items: [{ price: body.price, quantity: 1 }],
			mode: "subscription",
			allow_promotion_codes: body.allowPromotionCodes,
			automatic_tax: { enabled: true },
			subscription_data: {
				trial_from_plan: true,
				trial_period_days: body.trialPeriodDays,
			},
		})
	}
	return { error: "Error" }
}
