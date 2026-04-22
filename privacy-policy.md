# Privacy Policy — PDF Sign Chrome Extension

**Last updated:** April 22, 2026

This policy covers the **PDF Sign Chrome extension** only. For the marketing website at `pdf-sign-extension.pages.dev`, see the [website privacy policy](https://pdf-sign-extension.pages.dev/privacy.html).

## What the extension does

PDF Sign is a Chrome extension that lets you sign PDF documents directly in your browser. All PDF processing happens locally on your device — your files are never uploaded to any server.

## Data we collect

### Email address

When you sign in with Google, we receive your email address. We use it solely to:

- Authenticate your account
- Track how many documents you have signed (to enforce the free tier limit)

Your email is stored in our authentication provider (Supabase). We do not sell, share, or transfer your email to any third party.

### Usage count

We store a numeric counter of how many documents you have signed, linked to your account. This is used only to enforce the free tier limit (1 free document).

### IP address (transient, abuse prevention)

When you sign in, the sign-in endpoint briefly records the IP address your request originated from in a rate-limit log. This log is used exclusively to prevent abuse (brute-force token attempts, replay) on the anonymous sign-in endpoint. Entries are automatically deleted after 10 minutes and are never linked to your account or used for any other purpose.

## Data we do NOT collect

- PDF file contents — your documents never leave your device
- Browsing history or web activity
- Location data
- Keystrokes, mouse movements, or other user actions
- Website content

## Third-party services

- **Google Sign-In** — used for authentication only. Subject to [Google's Privacy Policy](https://policies.google.com/privacy).
- **Supabase** — our backend provider that stores your email, usage count, and the transient rate-limit log described above. Subject to [Supabase's Privacy Policy](https://supabase.com/privacy).
- **ExtensionPay** — used to process Pro subscription payments. ExtensionPay uses **Stripe** as its payment processor. Your payment information (card number, billing address) is handled entirely by Stripe and is never stored by us. Subject to [Stripe's Privacy Policy](https://stripe.com/privacy).

## Data retention

Your account data (email and usage count) is retained as long as you use the extension. Rate-limit log entries are deleted automatically after 10 minutes. To request deletion of your account, contact us at the email below.

## Contact

If you have questions about this privacy policy, contact us at: pdfsign.support@gmail.com
