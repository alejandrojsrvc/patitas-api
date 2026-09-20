import { Button, Text } from 'react-email';
import { EmailLayout, actionButtonStyle, actionTextStyle, noteStyle } from './email-layout';

export interface AccountConfirmationEmailProps {
  actionUrl: string;
}

export function AccountConfirmationEmail({ actionUrl }: AccountConfirmationEmailProps) {
  return (
    <EmailLayout
      preview="Un paso más para activar tu cuenta de Patitas Inquietas."
      eyebrow="Confirmación de cuenta"
      title="Confirmá tu correo"
      footer="Este es un correo transaccional de seguridad de Patitas Inquietas."
    >
      <Text>
        Tu cuenta está casi lista. Confirmá tu correo para consultar tus pedidos, guardar tus datos y comprar más rápido. Si tenés instalada
        la app, el enlace puede abrirla directamente.
      </Text>
      <Button href={actionUrl} style={actionButtonStyle}>
        Confirmar mi correo
      </Button>
      <Text style={actionTextStyle}>El enlace es temporal. Si no creaste una cuenta, ignorá este mensaje.</Text>
      <Text style={noteStyle}>Con tu cuenta podés consultar pedidos, guardar direcciones y ver tus reposiciones.</Text>
    </EmailLayout>
  );
}
