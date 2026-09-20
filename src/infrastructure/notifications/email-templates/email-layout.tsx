import { Body, Container, Head, Heading, Html, Preview, Section, Text } from 'react-email';
import type { CSSProperties, ReactNode } from 'react';

const pageStyle: CSSProperties = {
  backgroundColor: '#f7f9fc',
  fontFamily: 'SN Pro, Arial, sans-serif',
  margin: 0,
  padding: '32px 12px',
};

const containerStyle: CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #e8e8e3',
  borderRadius: 24,
  margin: '0 auto',
  maxWidth: 600,
  overflow: 'hidden',
};

const brandHeaderStyle: CSSProperties = {
  backgroundColor: '#0055ff',
  padding: '24px 28px 22px',
};

const brandStyle: CSSProperties = {
  color: '#ffffff',
  fontSize: 22,
  fontWeight: 700,
  letterSpacing: '-0.03em',
  lineHeight: '26px',
  margin: 0,
};

const brandAccentStyle: CSSProperties = {
  color: '#ffec00',
  fontWeight: 400,
};

const brandMetaStyle: CSSProperties = {
  color: '#ffffff',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.04em',
  lineHeight: '16px',
  margin: '8px 0 0',
  opacity: 0.82,
  textTransform: 'uppercase',
};

const accentRuleStyle: CSSProperties = {
  backgroundColor: '#ffec00',
  height: 4,
  lineHeight: '4px',
  margin: 0,
};

const contentStyle: CSSProperties = {
  padding: '32px 28px 28px',
};

const headingStyle: CSSProperties = {
  color: '#171717',
  fontSize: 30,
  fontWeight: 600,
  letterSpacing: '-0.03em',
  lineHeight: '33px',
  margin: '0 0 18px',
};

const textStyle: CSSProperties = {
  color: '#686868',
  fontSize: 16,
  lineHeight: '25px',
  margin: '0 0 18px',
};

const footerStyle: CSSProperties = {
  color: '#686868',
  fontSize: 12,
  lineHeight: '18px',
  margin: 0,
};

const footerSectionStyle: CSSProperties = {
  backgroundColor: '#f7f9fc',
  borderTop: '1px solid #e8e8e3',
  padding: '18px 28px 22px',
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
  footer = 'Este correo fue enviado por Patitas Inquietas.',
}: EmailLayoutProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={pageStyle}>
        <Container style={containerStyle}>
          <Section style={brandHeaderStyle}>
            <Text style={brandStyle}>
              patitas<span style={brandAccentStyle}> inquietas</span>
            </Text>
            <Text style={brandMetaStyle}>{eyebrow}</Text>
          </Section>
          <Section style={accentRuleStyle} />
          <Section style={contentStyle}>
            <Heading style={headingStyle}>{title}</Heading>
            <Section style={textStyle}>{children}</Section>
          </Section>
          <Section style={footerSectionStyle}>
            <Text style={footerStyle}>{footer}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export const actionButtonStyle: CSSProperties = {
  backgroundColor: '#0055ff',
  borderRadius: 12,
  color: '#ffffff',
  display: 'inline-block',
  fontSize: 15,
  fontWeight: 700,
  lineHeight: '20px',
  padding: '14px 24px',
  textDecoration: 'none',
};

export const actionTextStyle: CSSProperties = {
  color: '#686868',
  fontSize: 13,
  lineHeight: '20px',
  margin: '12px 0 0',
};

export const noteStyle: CSSProperties = {
  backgroundColor: '#eef4ff',
  borderRadius: 12,
  color: '#171717',
  fontSize: 13,
  lineHeight: '20px',
  margin: '22px 0 0',
  padding: '14px 16px',
};
