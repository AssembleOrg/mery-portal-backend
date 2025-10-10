export class WebhookNotificationDto {
  id: number;
  live_mode: boolean;
  type: string; // 'payment', 'merchant_order', 'chargebacks', etc.
  date_created: string;
  application_id: string;
  user_id: number;
  version: number;
  api_version: string;
  action: string; // 'payment.created', 'payment.updated', etc.
  data: {
    id: string; // ID del recurso (payment ID, order ID, etc.)
  };
}

export class MercadoPagoPaymentDto {
  id: number;
  date_created: string;
  date_approved: string | null;
  date_last_updated: string;
  money_release_date: string | null;
  operation_type: string;
  issuer_id: string;
  payment_method_id: string;
  payment_type_id: string;
  status: 'pending' | 'approved' | 'authorized' | 'in_process' | 'in_mediation' | 'rejected' | 'cancelled' | 'refunded' | 'charged_back';
  status_detail: string;
  currency_id: string;
  description: string;
  collector_id: number;
  payer: {
    id: number;
    email: string;
    identification: {
      type: string;
      number: string;
    };
    type: string;
  };
  metadata: {
    user_id?: string;
    category_ids?: string; // JSON string de array de IDs
    [key: string]: any;
  };
  additional_info: any;
  external_reference: string | null;
  transaction_amount: number;
  transaction_amount_refunded: number;
  coupon_amount: number;
  transaction_details: {
    net_received_amount: number;
    total_paid_amount: number;
    overpaid_amount: number;
    installment_amount: number;
  };
  installments: number;
  card: any;
}

