import { Button, Hr, Text } from 'react-email';
import {
  EmailLayout,
  actionButtonStyle,
  actionTextStyle,
} from './email-layout';

export interface AccountConfirmationEmailProps {
  actionUrl: string;
}

export function AccountConfirmationEmail({
  actionUrl,
}: AccountConfirmationEmailProps) {
  return (
    <EmailLayout
      preview="Confirmá tu cuenta de Patitas Inquietas."
      eyebrow="Confirmación de cuenta"
      title="Confirmá tu correo"
      footer="Este es un correo transaccional de seguridad de Patitas Inquietas."
    >
      <Text>
        Usá este enlace para confirmar tu correo y terminar de activar tu
        cuenta. Si tenés instalada la app, el mismo enlace puede abrirla
        directamente.
      </Text>
      <Button href={actionUrl} style={actionButtonStyle}>
        Confirmar mi cuenta
      </Button>
      <Hr />
      <Text style={actionTextStyle}>
        Si no creaste una cuenta, podés ignorar este mensaje.
      </Text>
    </EmailLayout>
  );
}
