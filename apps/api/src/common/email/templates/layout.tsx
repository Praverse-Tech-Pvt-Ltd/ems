import * as React from 'react';
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
  Hr,
  Link,
  Heading,
} from '@react-email/components';

interface EmailLayoutProps {
  previewText: string;
  title: string;
  children: React.ReactNode;
}

export const EmailLayout: React.FC<EmailLayoutProps> = ({
  previewText,
  title,
  children,
}) => {
  return (
    <Html lang="en">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.header}>
            <Heading style={styles.brand}>NEXGEN PHARMA</Heading>
            <Text style={styles.subtitle}>Employee Management System</Text>
          </Section>

          {/* Main Title */}
          <Section style={styles.contentHeader}>
            <Heading as="h2" style={styles.contentTitle}>{title}</Heading>
          </Section>

          {/* Content */}
          <Section style={styles.content}>
            {children}
          </Section>

          <Hr style={styles.hr} />

          {/* Footer */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              This is an automated notification from <strong>NexGen Pharma Solutions Pvt. Ltd.</strong> Internal Use Only.
            </Text>
            <Text style={styles.footerAddress}>
              413 &amp; 420, Prince Cube, Beside Gangotri Exotica, Laxmipura Char Rasta,{'\n'}
              Nayaran Garden, 30 Mtr Road, Gotri, Vadodara, Gujarat 390023, India
            </Text>
            <Text style={styles.footerText}>
              Need assistance? Email us at{' '}
              <Link href="mailto:inquiry@nexgenpharmasolutions.com" style={styles.link}>
                inquiry@nexgenpharmasolutions.com
              </Link>{' '}
              or call +91 75748 58458.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

const styles = {
  body: {
    backgroundColor: '#f9f6f0',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    padding: '24px 0',
    margin: 0,
  },
  container: {
    backgroundColor: '#ffffff',
    border: '4px solid #1a1a1a',
    boxShadow: '8px 8px 0px #1a1a1a',
    margin: '0 auto',
    maxWidth: '580px',
    padding: '40px 32px',
  },
  header: {
    backgroundColor: '#1a1a1a',
    padding: '24px',
    textAlign: 'center' as const,
    marginBottom: '32px',
    borderBottom: '4px solid #1a1a1a',
  },
  brand: {
    color: '#f5c518',
    fontSize: '28px',
    fontWeight: 'bold',
    margin: 0,
    letterSpacing: '-1px',
    textTransform: 'uppercase' as const,
  },
  subtitle: {
    color: '#ffffff',
    fontSize: '11px',
    fontWeight: 'bold',
    textTransform: 'uppercase' as const,
    letterSpacing: '2px',
    margin: '4px 0 0 0',
  },
  contentHeader: {
    marginBottom: '20px',
  },
  contentTitle: {
    color: '#1a1a1a',
    fontSize: '22px',
    fontWeight: 'bold',
    margin: 0,
    textTransform: 'uppercase' as const,
    letterSpacing: '-0.5px',
  },
  content: {
    color: '#1a1a1a',
    fontSize: '15px',
    lineHeight: '1.6',
  },
  hr: {
    borderColor: '#1a1a1a',
    borderWidth: '2px',
    margin: '32px 0 24px 0',
  },
  footer: {
    textAlign: 'center' as const,
  },
  footerText: {
    color: '#555555',
    fontSize: '12px',
    lineHeight: '1.5',
    margin: '4px 0',
  },
  footerAddress: {
    color: '#777777',
    fontSize: '11px',
    lineHeight: '1.5',
    margin: '6px 0',
    fontStyle: 'italic' as const,
  },
  link: {
    color: '#1a1a1a',
    textDecoration: 'underline',
    fontWeight: 'bold',
  },
};
