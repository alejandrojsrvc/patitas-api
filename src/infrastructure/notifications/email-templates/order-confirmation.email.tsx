import { Button, Hr, Link, Row, Section, Text } from 'react-email';
import { EmailLayout, actionButtonStyle, actionTextStyle } from './email-layout';

export interface OrderConfirmationEmailProps {
  customerName: string;
  orderNumber: string;
  orderDate: string;
  paymentStatus: string;
  paymentMethod: string;
  items: Array<{ name: string; quantity: number; unitPrice: string; total: string }>;
  subtotal: string;
  discount: string;
  shipping: string;
  total: string;
  address: string;
  deliveryEstimate: string;
  actionUrl: string;
  actionLabel: string;
  supportUrl: string;
  status: 'approved' | 'pending' | 'failed';
}

export function OrderConfirmationEmail(props: OrderConfirmationEmailProps) {
  const title =
    props.status === 'approved'
      ? '¡Gracias por tu compra!'
      : props.status === 'pending'
        ? 'Estamos confirmando tu pago'
        : 'No pudimos confirmar tu pago';
  const intro =
    props.status === 'approved'
      ? `Hola ${props.customerName}, recibimos tu pedido y ya estamos preparando todo.`
      : props.status === 'pending'
        ? 'No vuelvas a pagar: te avisaremos por este medio cuando el pago quede confirmado.'
        : 'El pedido quedó pendiente de pago. Podés revisar el motivo e intentar nuevamente cuando esté disponible.';

  return (
    <EmailLayout preview={`Pedido #${props.orderNumber} · Patitas Inquietas`} eyebrow="Tu pedido" title={title}>
      <Text>{intro}</Text>
      <Section style={highlightStyle}>
        <Text style={labelStyle}>Pedido</Text>
        <Text style={numberStyle}>#{props.orderNumber}</Text>
        <Text style={mutedStyle}>
          {props.orderDate} · {props.paymentStatus}
        </Text>
      </Section>
      <Button href={props.actionUrl} style={actionButtonStyle}>
        {props.actionLabel}
      </Button>
      <Text style={actionTextStyle}>Crear tu cuenta te permite consultar pedidos, entrega y soporte desde un solo lugar.</Text>
      <Hr style={ruleStyle} />
      <Text style={sectionTitle}>Resumen de compra</Text>
      {props.items.map((item) => (
        <Row key={`${item.name}-${item.quantity}`}>
          <Text style={itemStyle}>
            {item.quantity} × {item.name}
            <br />
            <span style={mutedStyle}>{item.unitPrice} c/u</span>
          </Text>
          <Text style={priceStyle}>{item.total}</Text>
        </Row>
      ))}
      <Row>
        <Text style={mutedStyle}>Subtotal</Text>
        <Text style={priceStyle}>{props.subtotal}</Text>
      </Row>
      <Row>
        <Text style={mutedStyle}>Descuentos</Text>
        <Text style={priceStyle}>-{props.discount}</Text>
      </Row>
      <Row>
        <Text style={mutedStyle}>Envío</Text>
        <Text style={priceStyle}>{props.shipping}</Text>
      </Row>
      <Row>
        <Text style={totalLabel}>Total</Text>
        <Text style={totalPrice}>{props.total}</Text>
      </Row>
      <Hr style={ruleStyle} />
      <Text style={sectionTitle}>Entrega</Text>
      <Text style={mutedStyle}>{props.address}</Text>
      <Text style={mutedStyle}>{props.deliveryEstimate}</Text>
      <Text style={mutedStyle}>Método de pago: {props.paymentMethod}</Text>
      <Text style={supportStyle}>
        ¿Necesitás ayuda? <Link href={props.supportUrl}>Contactá a soporte</Link>.
      </Text>
    </EmailLayout>
  );
}

const highlightStyle = { backgroundColor: '#f1f8ee', borderRadius: 10, margin: '20px 0', padding: '14px 16px' };
const labelStyle = { color: '#52734d', fontSize: 12, fontWeight: 700, margin: 0, textTransform: 'uppercase' as const };
const numberStyle = { color: '#17211b', fontSize: 24, fontWeight: 700, margin: '4px 0' };
const mutedStyle = { color: '#6b7280', fontSize: 13, lineHeight: '20px', margin: '4px 0' };
const ruleStyle = { borderColor: '#e5e7eb', margin: '24px 0' };
const sectionTitle = { color: '#17211b', fontSize: 16, fontWeight: 700, margin: '0 0 10px' };
const itemStyle = { color: '#374151', fontSize: 14, lineHeight: '20px', margin: '8px 0' };
const priceStyle = { color: '#374151', fontSize: 14, margin: '8px 0', textAlign: 'right' as const };
const totalLabel = { color: '#17211b', fontSize: 16, fontWeight: 700, margin: '12px 0' };
const totalPrice = { ...totalLabel, textAlign: 'right' as const };
const supportStyle = { color: '#6b7280', fontSize: 13, lineHeight: '20px', marginTop: 24 };
