import { Button, Hr, Text } from 'react-email';
import {
  EmailLayout,
  actionButtonStyle,
  actionTextStyle,
} from './email-layout';

export interface PasswordRecoveryEmailProps {
  actionUrl: string;
}

export function PasswordRecoveryEmail({
  actionUrl,
}: PasswordRecoveryEmailProps) {
  return (
    <EmailLayout
      preview="Recuperá el acceso a tu cuenta de Patitas Inquietas."
      eyebrow="Seguridad de la cuenta"
      title="Restablecé tu contraseña"
      footer="Este es un correo transaccional de seguridad de Patitas Inquietas."
    >
      <Text>
        Recibimos una solicitud para cambiar tu contraseña. El enlace es
        temporal y sólo puede utilizarse una vez.
      </Text>
      <Button href={actionUrl} style={actionButtonStyle}>
        Crear una contraseña nueva
      </Button>
      <Hr />
      <Text style={actionTextStyle}>
        Si no solicitaste este cambio, ignorá el mensaje y tu contraseña seguirá
        siendo la misma.
      </Text>
    </EmailLayout>
  );
}
