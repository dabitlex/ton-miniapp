// src/app/privacy/page.tsx
// Datenschutz-Seite (Telegram Apps Center, Abschnitt 5 — Disclosure).
// Erreichbar auf allen Plattformen (liegt bewusst außerhalb der (game)-Gruppe,
// also nicht hinter dem PlatformGate). Inhalt vor Veröffentlichung prüfen/anpassen
// (Kontakt, juristische Entität, Jurisdiktion).
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — VEXALGO',
  description: 'How VEXALGO collects, uses and protects your data.',
}

const UPDATED = 'June 2026'

export default function PrivacyPage() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        background: '#08080e',
        color: 'rgba(255,255,255,0.85)',
        padding: '32px 20px 64px',
      }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto', lineHeight: 1.6, fontSize: 15 }}>
        <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 700, marginBottom: 6 }}>
          Privacy Policy
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 0 }}>
          Last updated: {UPDATED}
        </p>

        <p>
          This Privacy Policy explains how VEXALGO (&quot;we&quot;, &quot;us&quot;) collects, uses, and
          protects your information when you use our Telegram Mini App (the &quot;App&quot;). By
          using the App, you agree to the practices described here.
        </p>

        <Section title="1. Data We Collect">
          <p>We collect only what is needed to run the App:</p>
          <ul style={ulStyle}>
            <li>
              <b>Telegram account information</b> provided by Telegram when you open the App
              (your Telegram user ID, username, first/last name, language code, and profile
              photo, where available).
            </li>
            <li>
              <b>Wallet address</b> — only if you choose to connect a TON wallet via TON
              Connect. We store your public wallet address to enable in-app features. We never
              access your private keys or seed phrase.
            </li>
            <li>
              <b>Gameplay data</b> — your progress and activity in the App, such as XP, level,
              quests, streaks, achievements, referrals, clan membership, boosts, ad views, and
              purchases.
            </li>
            <li>
              <b>Usage &amp; device analytics</b> — collected via the Telegram Mini Apps
              Analytics SDK to understand how the App is used and to improve it (e.g. session
              and interaction data, platform, approximate performance metrics).
            </li>
          </ul>
        </Section>

        <Section title="2. Why We Collect It">
          <ul style={ulStyle}>
            <li>To provide the App and your account, and to sync your progress across devices.</li>
            <li>To operate features such as leaderboards, quests, referrals, clans and boosts.</li>
            <li>To process in-app purchases and ecosystem support on the TON blockchain.</li>
            <li>To detect and prevent fraud, abuse and automated cheating.</li>
            <li>To analyze and improve the App&apos;s functionality and user experience.</li>
          </ul>
        </Section>

        <Section title="3. How It Is Stored">
          <p>
            Your data is stored on our backend infrastructure (Supabase) and processed to
            deliver the App. We apply reasonable technical and organizational measures to
            protect it. No method of transmission or storage is completely secure, and we
            cannot guarantee absolute security.
          </p>
        </Section>

        <Section title="4. Third Parties">
          <p>We rely on the following third-party services, each with its own privacy practices:</p>
          <ul style={ulStyle}>
            <li><b>Telegram</b> — provides the Mini App platform and your account data.</li>
            <li><b>TON Connect</b> — enables wallet connection (public address only).</li>
            <li><b>Telegram Mini Apps Analytics</b> — usage analytics.</li>
            <li><b>Advertising partners</b> — if you watch rewarded ads in the App.</li>
          </ul>
          <p>
            We do not sell your personal data, and we do not share it with third parties except
            as needed to provide the App or as required by law.
          </p>
        </Section>

        <Section title="5. Your Choices &amp; Rights">
          <ul style={ulStyle}>
            <li>
              <b>Disconnect your wallet</b> at any time from within the App, which removes the
              stored wallet address association.
            </li>
            <li>
              Depending on your jurisdiction (e.g. GDPR, CCPA), you may have rights to access,
              correct, or delete your personal data. To make a request, contact us using the
              details below.
            </li>
          </ul>
        </Section>

        <Section title="6. Children">
          <p>
            The App is not directed to children under the age required by your local law to
            consent to data processing. We do not knowingly collect data from such children.
          </p>
        </Section>

        <Section title="7. Changes to This Policy">
          <p>
            We may update this Policy from time to time. Material changes will be reflected by
            updating the &quot;Last updated&quot; date above. Continued use of the App after changes
            constitutes acceptance of the updated Policy.
          </p>
        </Section>

        <Section title="8. Contact">
          <p>
            For privacy questions or data requests, contact us via{' '}
            <a href="https://t.me/Vexalgo_bot" style={{ color: '#5EEAD4' }}>
              @Vexalgo_bot
            </a>
            .
          </p>
        </Section>
      </div>
    </main>
  )
}

const ulStyle: React.CSSProperties = { paddingLeft: 20, margin: '8px 0' }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{title}</h2>
      {children}
    </section>
  )
}
