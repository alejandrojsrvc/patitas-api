import { Button, Hr, Text } from 'react-email';
import {
  EmailLayout,
  actionButtonStyle,
  actionTextStyle,
} from './email-layout';

export interface ReplenishmentReminderEmailProps {
  petName: string;
  planId: string;
  appUrl: string;
}

export function ReplenishmentReminderEmail({
  petName,
  planId,
  appUrl,
}: ReplenishmentReminderEmailProps) {
  return (
    <EmailLayout
      preview={`Puede estar por terminar el alimento de ${petName}.`}
      eyebrow="Recordatorio"
      title={`¿Está por terminarse el alimento de ${petName}?`}
    >
      <Text>
        Te avisamos para que puedas revisar la recompra con tiempo. La compra
        siempre requiere tu confirmación; no hacemos cobros automáticos.
      </Text>
      <Button href={appUrl} style={actionButtonStyle}>
        Ver opciones de recompra
      </Button>
      <Hr />
      <Text style={actionTextStyle}>
        Si preferís no recibir más recordatorios, podés pausar el plan desde tu
        cuenta. Referencia:{` ${planId}`}
      </Text>
    </EmailLayout>
  );
}
