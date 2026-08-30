import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'react-email';
import type { CSSProperties, ReactNode } from 'react';

const pageStyle: CSSProperties = {
  backgroundColor: '#f6f7f5',
  fontFamily: 'Arial, sans-serif',
  margin: 0,
  padding: '32px 16px',
};

const containerStyle: CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: 12,
  margin: '0 auto',
  maxWidth: 560,
  padding: '32px 28px',
};

const eyebrowStyle: CSSProperties = {
  color: '#6b7280',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 1,
  margin: '0 0 12px',
  textTransform: 'uppercase',
};

const headingStyle: CSSProperties = {
  color: '#17211b',
  fontSize: 28,
  lineHeight: '34px',
  margin: '0 0 16px',
};

const textStyle: CSSProperties = {
  color: '#4b5563',
  fontSize: 16,
  lineHeight: '24px',
};

const footerStyle: CSSProperties = {
  color: '#9ca3af',
  fontSize: 12,
  lineHeight: '18px',
  margin: '24px 0 0',
};

export interface EmailLayoutProps {
  preview: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
  footer?: string;
}

export function EmailLayout({
  preview,
  eyebrow,
  title,
  children,
  footer = 'Recibís este correo porque aceptaste recibir comunicaciones de Patitas Inquietas. Podés cancelar los avisos desde tu cuenta.',
}: EmailLayoutProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={pageStyle}>
        <Container style={containerStyle}>
          <Text style={eyebrowStyle}>Patitas Inquietas · {eyebrow}</Text>
          <Heading style={headingStyle}>{title}</Heading>
          <Section style={textStyle}>{children}</Section>
          <Text style={footerStyle}>{footer}</Text>
        </Container>
      </Body>
    </Html>
  );
}

export const actionButtonStyle: CSSProperties = {
  backgroundColor: '#e7b83c',
  borderRadius: 8,
  color: '#17211b',
  display: 'inline-block',
  fontSize: 16,
  fontWeight: 700,
  padding: '12px 18px',
  textDecoration: 'none',
};

export const actionTextStyle: CSSProperties = {
  color: '#6b7280',
  fontSize: 13,
  lineHeight: '20px',
};
