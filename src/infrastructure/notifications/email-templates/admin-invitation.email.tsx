import { Button, Hr, Text } from 'react-email';
import { EmailLayout, actionButtonStyle, actionTextStyle } from './email-layout';

export interface AdminInvitationEmailProps {
  actionUrl: string;
}

export function AdminInvitationEmail({ actionUrl }: AdminInvitationEmailProps) {
  return (
    <EmailLayout
      preview="Aceptá tu invitación administrativa a Patitas Inquietas."
      eyebrow="Acceso administrativo"
      title="Completá tu cuenta"
      footer="Este es un correo transaccional de seguridad de Patitas Inquietas."
    >
      <Text>Te invitaron a administrar Patitas Inquietas. El enlace es temporal y sólo puede utilizarse una vez.</Text>
      <Button href={actionUrl} style={actionButtonStyle}>
        Crear contraseña
      </Button>
      <Hr />
      <Text style={actionTextStyle}>Si no esperabas esta invitación, ignorá el mensaje.</Text>
    </EmailLayout>
  );
}
