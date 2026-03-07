import type { Payment } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { BillingCard } from "./BillingCard";
import { formatMoney, formatShortDate } from "./constants";

export function PaymentHistory({ payments }: { payments: Payment[] }) {
  if (payments.length === 0) return null;

  return (
    <BillingCard title="Payment History" description="Recent charges from Stripe.">
      <div className="flex flex-col divide-y divide-cb">
        {payments.map((payment) => (
          <div key={payment.id} className="flex items-center justify-between py-3 gap-4">
            <div>
              <p className="text-xs font-medium text-cb-primary">{formatShortDate(payment.createdAt)}</p>
              <p className="text-2xs text-cb-muted mt-0.5 font-mono uppercase">{payment.provider}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-mono text-cb-primary">{formatMoney(payment.amount, payment.currency)}</span>
              <Badge variant={payment.status === "SUCCESS" ? "success" : payment.status === "FAILED" ? "danger" : "default"}>
                {payment.status.charAt(0) + payment.status.slice(1).toLowerCase()}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </BillingCard>
  );
}
