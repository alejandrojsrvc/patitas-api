import { Button, Text } from 'react-email';
import { EmailLayout, actionButtonStyle, actionTextStyle, noteStyle } from './email-layout';

export interface PasswordRecoveryEmailProps {
  actionUrl: string;
}

export function PasswordRecoveryEmail({ actionUrl }: PasswordRecoveryEmailProps) {
  return (
    <EmailLayout
      preview="Volvé a entrar a tu cuenta de Patitas Inquietas."
      eyebrow="Seguridad de la cuenta"
      title="Recuperá el acceso a tu cuenta"
      footer="Este es un correo transaccional de seguridad de Patitas Inquietas."
    >
      <Text>Recibimos una solicitud para cambiar tu contraseña. Usá el botón para crear una nueva y volver a entrar a tu cuenta.</Text>
      <Button href={actionUrl} style={actionButtonStyle}>
        Restablecer contraseña
      </Button>
      <Text style={actionTextStyle}>Si no solicitaste este cambio, ignorá el mensaje y tu contraseña seguirá siendo la misma.</Text>
      <Text style={noteStyle}>Por seguridad, el enlace es temporal y sólo puede utilizarse una vez.</Text>
    </EmailLayout>
  );
}
