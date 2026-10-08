// Supabase credentials. These are safe to ship to the browser — the
// publishable key is read-only-by-default; row-level security policies
// (set up in supabase/schema.sql) decide what authenticated users can do.
//
// To rotate: replace KEY with a new one from Project Settings → API.

window.SUPABASE_CONFIG = {
  url: 'https://hmqeaxarthtfstfrlnlx.supabase.co',
  publishableKey: 'sb_publishable_39b3g7lnKz-1uxmy2tSxNw_VnYqEFAF',
  // Google Workspace domain pre-selected in the "Continue with Google"
  // account picker. A hint only — invite-only sign-up is the access control.
  googleHostedDomain: 'rockcreekteletherapy.com',
};
