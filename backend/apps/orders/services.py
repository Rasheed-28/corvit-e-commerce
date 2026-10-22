import logging
from decimal import Decimal
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils.html import escape

logger = logging.getLogger(__name__)


def _get_order_recipient(order) -> tuple[str, str]:
    """
    Extracts the recipient name and email address from the order and user records.
    """
    email = ''
    name = 'Valued Customer'

    if order.user and order.user.email:
        email = order.user.email
        name = order.user.get_full_name() or order.user.username

    # Fallback to shipping address snapshot if user record is missing email
    if not email and order.shipping_address_snapshot:
        snapshot = order.shipping_address_snapshot
        email = snapshot.get('email', '')
        if snapshot.get('full_name'):
            name = snapshot['full_name']

    return name, email


def _format_address(snapshot: dict) -> str:
    """Formats shipping address snapshot as plain text."""
    if not snapshot:
        return 'Standard Courier Delivery'

    parts = [
        snapshot.get('full_name', ''),
        snapshot.get('street_address_1', ''),
        snapshot.get('street_address_2', ''),
        f"{snapshot.get('city', '')}, {snapshot.get('state_or_province', '')} {snapshot.get('postal_code', '')}".strip(),
        snapshot.get('country', ''),
    ]
    return '\n'.join(p for p in parts if p)


def send_order_confirmation_email(order) -> bool:
    """
    Sends an itemized order confirmation email to the customer upon purchase.
    Dispatches both plain-text and HTML formats fail-safely.
    """
    name, email = _get_order_recipient(order)
    if not email:
        logger.info(f"Skipping order confirmation email for order {order.order_number}: no recipient email available.")
        return False

    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
    order_url = f"{frontend_url}/orders/{order.order_number}"
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@ecommerce.example.com')
    subject = f"Order Confirmation: #{order.order_number}"

    # Build line items text
    items_list = list(order.items.all())
    items_text_lines = []
    items_html_rows = []

    for item in items_list:
        variant_info = f" ({item.variant_name})" if item.variant_name else ""
        items_text_lines.append(f"  • {item.quantity}x {item.product_title}{variant_info} — ${item.line_total:.2f}")
        items_html_rows.append(
            f"<tr>"
            f"<td style='padding: 8px 12px; border-bottom: 1px solid #e5e7eb;'>{escape(item.product_title)}{escape(variant_info)}</td>"
            f"<td style='padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;'>{item.quantity}</td>"
            f"<td style='padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;'>${item.line_total:.2f}</td>"
            f"</tr>"
        )

    items_text = "\n".join(items_text_lines)
    items_html = "".join(items_html_rows)
    address_text = _format_address(order.shipping_address_snapshot)

    discount_line = f"\nDiscount Applied: -${order.discount_amount:.2f}" if order.discount_amount > Decimal('0.00') else ""
    discount_html = f"<tr><td colspan='2' style='padding: 6px 12px; text-align: right; color: #059669;'>Discount:</td><td style='padding: 6px 12px; text-align: right; color: #059669;'>-${order.discount_amount:.2f}</td></tr>" if order.discount_amount > Decimal('0.00') else ""

    text_body = (
        f"Hello {name},\n\n"
        f"Thank you for your order! We have received your purchase and are preparing your shipment.\n\n"
        f"Order Number: {order.order_number}\n"
        f"Status: {order.get_status_display()}\n\n"
        f"Items Ordered:\n"
        f"{items_text}\n\n"
        f"Subtotal: ${order.subtotal:.2f}\n"
        f"Shipping: {'Free' if order.shipping_fee == Decimal('0.00') else f'${order.shipping_fee:.2f}'}\n"
        f"Estimated Tax: ${order.tax_amount:.2f}"
        f"{discount_line}\n"
        f"Total: ${order.total_amount:.2f} {order.currency}\n\n"
        f"Delivery Destination:\n"
        f"{address_text}\n\n"
        f"You can review your complete order details, invoice, and tracking updates anytime at:\n"
        f"{order_url}\n\n"
        f"Thank you for shopping with us!\n"
        f"The Support Team"
    )

    html_body = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937; background-color: #f9fafb; margin: 0; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e5e7eb; padding: 32px;">
    <h2 style="margin-top: 0; color: #111827; font-size: 24px;">Order Confirmed!</h2>
    <p style="font-size: 14px; color: #4b5563;">Hello <strong>{escape(name)}</strong>,</p>
    <p style="font-size: 14px; color: #4b5563;">Thank you for your purchase. We have received your order <strong>#{escape(order.order_number)}</strong> and our team is preparing it for shipment.</p>

    <div style="margin: 24px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <thead>
          <tr style="background-color: #f3f4f6; color: #374151;">
            <th style="padding: 8px 12px; text-align: left;">Item</th>
            <th style="padding: 8px 12px; text-align: center;">Qty</th>
            <th style="padding: 8px 12px; text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          {items_html}
          <tr><td colspan="2" style="padding: 8px 12px; text-align: right; color: #6b7280;">Subtotal:</td><td style="padding: 8px 12px; text-align: right;">${order.subtotal:.2f}</td></tr>
          <tr><td colspan="2" style="padding: 6px 12px; text-align: right; color: #6b7280;">Shipping:</td><td style="padding: 6px 12px; text-align: right;">{"Free" if order.shipping_fee == Decimal('0.00') else f"${order.shipping_fee:.2f}"}</td></tr>
          <tr><td colspan="2" style="padding: 6px 12px; text-align: right; color: #6b7280;">Estimated Tax:</td><td style="padding: 6px 12px; text-align: right;">${order.tax_amount:.2f}</td></tr>
          {discount_html}
          <tr style="font-size: 15px; font-weight: bold; border-top: 2px solid #e5e7eb;"><td colspan="2" style="padding: 10px 12px; text-align: right; color: #111827;">Total:</td><td style="padding: 10px 12px; text-align: right; color: #059669;">${order.total_amount:.2f} {order.currency}</td></tr>
        </tbody>
      </table>
    </div>

    <div style="margin-top: 24px; padding: 16px; background-color: #f9fafb; border-radius: 12px; font-size: 13px; color: #4b5563;">
      <strong style="color: #111827;">Delivery Address:</strong><br/>
      {escape(address_text).replace(chr(10), '<br/>')}
    </div>

    <div style="margin-top: 32px; text-align: center;">
      <a href="{order_url}" style="background-color: #059669; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">View Order Details</a>
    </div>

    <p style="margin-top: 32px; font-size: 12px; color: #9ca3af; text-align: center;">
      If you have questions about your purchase, please contact our support desk.
    </p>
  </div>
</body>
</html>"""

    try:
        msg = EmailMultiAlternatives(subject, text_body, from_email, [email])
        msg.attach_alternative(html_body, "text/html")
        msg.send(fail_silently=False)
        logger.info(f"Order confirmation email sent to {email} for order {order.order_number}.")
        return True
    except Exception as exc:
        logger.warning(f"Failed to send order confirmation email for {order.order_number} to {email}: {exc}")
        return False


def send_order_status_update_email(order, previous_status: str, new_status: str, reason: str = '') -> bool:
    """
    Sends an order lifecycle transition email (e.g. PROCESSING, SHIPPED, DELIVERED, CANCELLED, REFUNDED).
    Dispatches both plain-text and HTML formats fail-safely.
    """
    name, email = _get_order_recipient(order)
    if not email:
        logger.info(f"Skipping order status email for order {order.order_number}: no recipient email available.")
        return False

    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
    order_url = f"{frontend_url}/orders/{order.order_number}"
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@ecommerce.example.com')
    subject = f"Order #{order.order_number} Update: {order.get_status_display()}"

    # Status-specific contextual message
    status_explanations = {
        'PAID': "We have received and verified your payment. Your order is now confirmed and will be processed promptly.",
        'PROCESSING': "Your order is currently being hand-picked, inspected, and packaged for courier dispatch.",
        'SHIPPED': "Great news! Your package has been dispatched from our fulfillment center and is on its way to your destination.",
        'DELIVERED': "Your package has arrived! We hope you love your new purchase.",
        'CANCELLED': f"Your order #{order.order_number} has been cancelled." + (f" Reason: {reason}" if reason else ""),
        'REFUNDED': f"A refund of ${order.total_amount:.2f} has been processed for your order." + (f" Reason: {reason}" if reason else ""),
    }

    explanation = status_explanations.get(
        new_status,
        f"Your order status has changed from '{previous_status}' to '{new_status}'."
    )

    text_body = (
        f"Hello {name},\n\n"
        f"We're writing to let you know that the status of order #{order.order_number} has been updated.\n\n"
        f"New Status: {order.get_status_display()}\n\n"
        f"{explanation}\n\n"
        f"You can view complete tracking information and details for this order online:\n"
        f"{order_url}\n\n"
        f"Thank you for shopping with us,\n"
        f"The Customer Support Team"
    )

    html_body = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937; background-color: #f9fafb; margin: 0; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e5e7eb; padding: 32px;">
    <h2 style="margin-top: 0; color: #111827; font-size: 22px;">Order Status Update</h2>
    <p style="font-size: 14px; color: #4b5563;">Hello <strong>{escape(name)}</strong>,</p>
    <p style="font-size: 14px; color: #4b5563;">The status of your order <strong>#{escape(order.order_number)}</strong> has been updated to:</p>

    <div style="margin: 20px 0; padding: 16px; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; text-align: center;">
      <span style="font-size: 18px; font-weight: bold; color: #065f46;">{escape(order.get_status_display())}</span>
    </div>

    <p style="font-size: 14px; color: #374151; line-height: 1.6;">{escape(explanation)}</p>

    <div style="margin-top: 32px; text-align: center;">
      <a href="{order_url}" style="background-color: #059669; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">Track & View Order</a>
    </div>

    <p style="margin-top: 32px; font-size: 12px; color: #9ca3af; text-align: center;">
      If you have questions regarding this update, please reply to this message or visit our help center.
    </p>
  </div>
</body>
</html>"""

    try:
        msg = EmailMultiAlternatives(subject, text_body, from_email, [email])
        msg.attach_alternative(html_body, "text/html")
        msg.send(fail_silently=False)
        logger.info(f"Order status update email sent to {email} for order {order.order_number} ({new_status}).")
        return True
    except Exception as exc:
        logger.warning(f"Failed to send status update email for {order.order_number} to {email}: {exc}")
        return False
