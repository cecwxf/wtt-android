import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/auth';
import { useAppSettingsStore } from '@/stores/app-settings';

export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const appSettingsLoaded = useAppSettingsStore((s) => s.loaded);
  const privacyConsentAccepted = useAppSettingsStore((s) => s.privacyConsentAccepted);

  if (!appSettingsLoaded) {
    return null;
  }

  if (!privacyConsentAccepted) {
    return <Redirect href={'/(auth)/privacy-consent' as never} />;
  }

  return <Redirect href={isAuthenticated ? '/(tabs)' : '/(auth)/login'} />;
}
