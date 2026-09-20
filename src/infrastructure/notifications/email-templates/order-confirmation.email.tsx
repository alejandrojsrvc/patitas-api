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
      ? '¡Tu pedido está confirmado!'
      : props.status === 'pending'
        ? 'Estamos confirmando tu pago'
        : 'No pudimos confirmar tu pago';
  const intro =
    props.status === 'approved'
      ? `Hola ${props.customerName}: recibimos tu pedido y ya podés consultar sus detalles.`
      : props.status === 'pending'
        ? 'El pago todavía no quedó confirmado. No vuelvas a pagar. Te avisaremos por este medio cuando el pago quede confirmado.'
        : 'Revisá el estado del pedido y las opciones disponibles desde el botón.';
  const statusLabel = props.status === 'approved' ? 'Pago confirmado' : props.status === 'pending' ? 'Pago pendiente' : 'Pago no confirmado';
  const statusStyle = props.status === 'approved' ? approvedStatusStyle : props.status === 'pending' ? pendingStatusStyle : failedStatusStyle;

  return (
    <EmailLayout
      preview={`${statusLabel} · Pedido #${props.orderNumber}`}
      eyebrow="Tu pedido"
      title={title}
      footer="Recibís este correo porque realizaste una compra en Patitas Inquietas."
    >
      <Text>{intro}</Text>
      <Section style={statusStyle}>
        <Text style={labelStyle}>{statusLabel}</Text>
        <Text style={numberStyle}>Pedido #{props.orderNumber}</Text>
        <Text style={mutedStyle}>{props.orderDate}</Text>
      </Section>
      <Button href={props.actionUrl} style={actionButtonStyle}>
        {props.actionLabel}
      </Button>
      <Text style={actionTextStyle}>Desde ahí podés consultar el pedido, la entrega y la información de soporte.</Text>
      <Hr style={ruleStyle} />
      <Text style={sectionTitle}>Resumen de compra</Text>
      <Section style={summaryStyle}>
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
      </Section>
      <Hr style={ruleStyle} />
      <Section style={deliveryStyle}>
        <Text style={deliveryTitle}>Entrega</Text>
        <Text style={deliveryText}>{props.address}</Text>
        <Text style={deliveryText}>{props.deliveryEstimate}</Text>
        <Text style={deliveryText}>Método de pago: {props.paymentMethod}</Text>
      </Section>
      <Text style={supportStyle}>
        ¿Necesitás ayuda? <Link href={props.supportUrl}>Contactá a soporte</Link>.
      </Text>
    </EmailLayout>
  );
}

const approvedStatusStyle = { backgroundColor: '#eef4ff', borderRadius: 12, margin: '22px 0', padding: '16px' };
const pendingStatusStyle = { backgroundColor: '#fff9c7', borderRadius: 12, margin: '22px 0', padding: '16px' };
const failedStatusStyle = { backgroundColor: '#fff1f0', borderRadius: 12, margin: '22px 0', padding: '16px' };
const labelStyle = { color: '#0055ff', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', margin: 0, textTransform: 'uppercase' as const };
const numberStyle = { color: '#171717', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', margin: '5px 0' };
const mutedStyle = { color: '#686868', fontSize: 13, lineHeight: '20px', margin: '4px 0' };
const ruleStyle = { borderColor: '#e8e8e3', margin: '26px 0' };
const sectionTitle = { color: '#171717', fontSize: 16, fontWeight: 700, margin: '0 0 10px' };
const summaryStyle = { backgroundColor: '#fafaf8', border: '1px solid #e8e8e3', borderRadius: 12, padding: '8px 14px' };
const itemStyle = { color: '#171717', fontSize: 14, lineHeight: '20px', margin: '8px 0' };
const priceStyle = { color: '#171717', fontSize: 14, margin: '8px 0', textAlign: 'right' as const };
const totalLabel = { color: '#171717', fontSize: 16, fontWeight: 700, margin: '12px 0' };
const totalPrice = { ...totalLabel, textAlign: 'right' as const };
const deliveryStyle = { backgroundColor: '#eef4ff', borderRadius: 12, margin: 0, padding: '16px' };
const deliveryTitle = { color: '#0055ff', fontSize: 16, fontWeight: 700, margin: '0 0 8px' };
const deliveryText = { color: '#171717', fontSize: 13, lineHeight: '20px', margin: '4px 0' };
const supportStyle = { color: '#686868', fontSize: 13, lineHeight: '20px', margin: '22px 0 0' };
