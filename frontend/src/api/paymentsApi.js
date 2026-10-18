import axiosClient from './axiosClient.js';
import { API_ROUTES } from '../utils/constants.js';

/**
 * Payments API Service Module
 * Handles safe client-side payment intent initialization and verification.
 * Strictly avoids transmitting or storing raw card numbers or CVV codes.
 */
export const paymentsApi = {
  /**
   * Fetches public payment provider readiness and configuration status.
   */
  async getConfig() {
    return axiosClient.get(API_ROUTES.PAYMENTS.CONFIG);
  },

  /**
   * Initializes a server-side payment intent/session linked to an Order.
   */
  async createIntent({ orderNumber, paymentMethod = 'CREDIT_CARD', idempotencyKey = '' }) {
    return axiosClient.post(API_ROUTES.PAYMENTS.INTENT, {
      order_number: orderNumber,
      payment_method: paymentMethod,
      idempotency_key: idempotencyKey,
    });
  },

  /**
   * Confirms payment and triggers server-side gateway verification.
   * Passes tokenized payment references instead of raw account numbers.
   */
  async confirmPayment({
    orderNumber,
    transactionId = '',
    paymentToken = 'tok_test_success',
    paymentMethod = 'CREDIT_CARD',
    simulateFailure = false,
    idempotencyKey = '',
  }) {
    return axiosClient.post(API_ROUTES.PAYMENTS.CONFIRM, {
      order_number: orderNumber,
      transaction_id: transactionId,
      payment_token: paymentToken,
      payment_method: paymentMethod,
      simulate_failure: simulateFailure,
      idempotency_key: idempotencyKey,
    });
  },

  /**
   * Staff/admin refund execution.
   */
  async refundPayment(transactionId, amount = null, reason = 'Customer refund') {
    return axiosClient.post(API_ROUTES.PAYMENTS.REFUND(transactionId), {
      amount,
      reason,
    });
  },
};

export default paymentsApi;
