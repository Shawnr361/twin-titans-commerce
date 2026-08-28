import { ReviewForm } from '@/components/commerce/ReviewForm';

export const metadata = { title: 'Leave a review' };
export const dynamic = 'force-dynamic';

export default function ReviewsPage() {
  return (
    <div className="shell py-16 md:py-24">
      <div className="mx-auto max-w-2xl">
        <header>
          <hr className="rule-gold" />
          <h1 className="display-l mt-5">Leave a review</h1>
          <p className="mt-4 text-body text-greige">
            Reviews come only from customers whose order has been delivered, so what you read on a
            product page is from someone who actually received it.
          </p>
        </header>

        <ReviewForm />
      </div>
    </div>
  );
}
