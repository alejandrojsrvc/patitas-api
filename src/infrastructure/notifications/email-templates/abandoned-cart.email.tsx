import { Button, Hr, Text } from 'react-email';
import {
  EmailLayout,
  actionButtonStyle,
  actionTextStyle,
} from './email-layout';

export interface AbandonedCartEmailProps {
  cartId: string;
  appUrl: string;
}

export function AbandonedCartEmail({
  cartId,
  appUrl,
}: AbandonedCartEmailProps) {
  return (
    <EmailLayout
      preview="Tu carrito de Patitas Inquietas sigue esperándote."
      eyebrow="Tu carrito"
      title="Tu carrito sigue esperándote"
    >
      <Text>
        Guardamos los productos que elegiste para que puedas retomar tu compra
        cuando quieras.
      </Text>
      <Button href={appUrl} style={actionButtonStyle}>
        Volver a Patitas
      </Button>
      <Hr />
      <Text style={actionTextStyle}>
        Si no reconocés este carrito, podés ignorar este mensaje. Referencia:
        {` ${cartId}`}
      </Text>
    </EmailLayout>
  );
}
