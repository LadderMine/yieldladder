import Link from 'next/link';

import styles from './info-pages.module.css';

type InfoShellProps = {
  eyebrow: string;
  title: string;
  lead: string;
  children: React.ReactNode;
};

const trustLinks = [
  { href: '/learn', label: 'Learn' },
  { href: '/faq', label: 'FAQ' },
  { href: '/audit', label: 'Audit' },
  { href: '/contracts', label: 'Contracts' },
  { href: '/roadmap', label: 'Roadmap' },
];

export function InfoShell({ eyebrow, title, lead, children }: InfoShellProps) {
  return (
    <div className={styles.page}>
      <nav className={styles.nav} aria-label="Primary">
        <Link href="/" className={styles.logo}>
          YieldLadder
        </Link>
        <div className={styles.navLinks}>
          {trustLinks.map((item) => (
            <Link key={item.href} href={item.href} className={styles.navLink}>
              {item.label}
            </Link>
          ))}
        </div>
        <Link href="/#vaults" className={styles.navCta}>
          View Vaults
        </Link>
      </nav>

      <main className={styles.main}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.lead}>{lead}</p>
        </header>
        {children}
      </main>

      <footer className={styles.footer}>
        <Link href="/" className={styles.footerBack}>
          Back to YieldLadder
        </Link>
        <div className={styles.footerLinks}>
          {trustLinks.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </div>
      </footer>
    </div>
  );
}

type ExternalLinkProps = {
  href: string;
  children: React.ReactNode;
};

export function ExternalLink({ href, children }: ExternalLinkProps) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}
