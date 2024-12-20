import Stripe from 'stripe';
import { stripe } from '@/utils/stripe/config';
import {
  upsertProductRecord,
  upsertPriceRecord,
  manageSubscriptionStatusChange,
  deleteProductRecord,
  deletePriceRecord
} from '@/utils/supabase/admin';

const relevantEvents = new Set([
  'product.created',
  'product.updated',
  'product.deleted',
  'price.created',
  'price.updated',
  'price.deleted',
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted'
]);

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature') as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event: Stripe.Event;

  try {
    if (!sig || !webhookSecret){
			console.log('Missing signature or webhook secret');
      return new Response('Webhook secret not found.', { status: 400 });
		}
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    //console.log(`🔔  Webhook received: ${event.type}`);
		//console.log('Event data:', JSON.stringify(event.data.object, null, 2));
  } catch (err: any) {
    //console.log(`❌ Error message: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (relevantEvents.has(event.type)) {
    try {
			switch (event.type) {
				case 'product.created':
				case 'product.updated':
					const productData = event.data.object as Stripe.Product;
					await upsertProductRecord(productData);

					if (productData.default_price) {
						// Handle default price for test mode products
						//console.log('Fetching default price:', productData.default_price);
						try {
							const defaultPrice = await stripe.prices.retrieve(productData.default_price as string);
							if (defaultPrice.active) {
								await upsertPriceRecord(defaultPrice);
							}
						} catch (error) {
							console.error('Error handling default price:', error);
						}
					}

					// Also fetch all active prices for this product
					// This handles both production cases and any additional test prices
					try {
						const prices = await stripe.prices.list({
							product: productData.id,
							active: true
						});
						for (const price of prices.data) {
							await upsertPriceRecord(price);
						}
					} catch (error) {
						console.error('Error fetching product prices:', error);
					}
					break;

				case 'price.deleted':
					await deletePriceRecord(event.data.object as Stripe.Price);
					break;
				case 'product.deleted':
					await deleteProductRecord(event.data.object as Stripe.Product);
					break;
				case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          const subscription = event.data.object as Stripe.Subscription;
          await manageSubscriptionStatusChange(
            subscription.id,
            subscription.customer as string,
            event.type === 'customer.subscription.created'
          );
          break;
        case 'checkout.session.completed':
          const checkoutSession = event.data.object as Stripe.Checkout.Session;
          if (checkoutSession.mode === 'subscription') {
            const subscriptionId = checkoutSession.subscription;
            await manageSubscriptionStatusChange(
              subscriptionId as string,
              checkoutSession.customer as string,
              true
            );
          }
          break;
        default:
          throw new Error('Unhandled relevant event!');
      }
    } catch (error) {
      console.log(error);
      return new Response(
        'Webhook handler failed. View your Next.js function logs.',
        {
          status: 400
        }
      );
    }
  } else {
    return new Response(`Unsupported event type: ${event.type}`, {
      status: 400
    });
  }
  return new Response(JSON.stringify({ received: true }));
}
