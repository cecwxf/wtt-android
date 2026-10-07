import { Redirect } from 'expo-router';

// The auth-session listener owns the code and its in-memory PKCE proof.
// A cold callback cannot recover that proof and must start a fresh login.
export default function OAuthCallback() {
  return <Redirect href="/(auth)/login" />;
}
