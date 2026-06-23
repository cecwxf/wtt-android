import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuthStore } from '@/stores/auth';
import {
  getOAuthRedirectUri,
  isOAuthProviderEnabled,
  startOAuthCodeFlow,
  type OAuthProvider,
} from '@/lib/auth/oauth';

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const login = useAuthStore((s) => s.login);
  const loginWithOAuth = useAuthStore((s) => s.loginWithOAuth);
  const githubEnabled = isOAuthProviderEnabled('github');
  const googleEnabled = isOAuthProviderEnabled('google');
  const twitterEnabled = isOAuthProviderEnabled('twitter');

  const handleLogin = async () => {
    const normalizedPhone = phone.trim();
    if (!normalizedPhone || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      await login(normalizedPhone, password);
      router.replace('/webview');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      Alert.alert('Login Failed', message);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: OAuthProvider) => {
    setOauthLoading(provider);
    try {
      const oauth = await startOAuthCodeFlow(provider);
      await loginWithOAuth(provider, oauth);
      router.replace('/webview');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'OAuth login failed';
      if (message !== 'OAuth cancelled') {
        Alert.alert('OAuth Login Failed', `${message}\n\nRedirect URI: ${getOAuthRedirectUri()}`);
      }
    } finally {
      setOauthLoading(null);
    }
  };

  const busy = loading || !!oauthLoading;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.root}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* Logo */}
        <View style={styles.logoArea}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoChar}>W</Text>
          </View>
          <Text style={styles.appName}>WTT</Text>
          <Text style={styles.tagline}>Agent Communication Platform</Text>
        </View>

        {/* OAuth — full-width rows like wtt-web */}
        {googleEnabled && (
          <TouchableOpacity
            style={styles.providerBtn}
            onPress={() => handleOAuthLogin('google')}
            disabled={!!oauthLoading}
            activeOpacity={0.7}
          >
            {oauthLoading === 'google' ? (
              <ActivityIndicator color="#EA4335" size="small" style={styles.providerSpinner} />
            ) : (
              <View style={[styles.providerIcon, { backgroundColor: '#FEF2F2' }]}>
                <Text style={styles.googleG}>G</Text>
              </View>
            )}
            <Text style={styles.providerLabel}>Continue with Google</Text>
          </TouchableOpacity>
        )}
        {githubEnabled && (
          <TouchableOpacity
            style={styles.providerBtn}
            onPress={() => handleOAuthLogin('github')}
            disabled={!!oauthLoading}
            activeOpacity={0.7}
          >
            {oauthLoading === 'github' ? (
              <ActivityIndicator color="#1F2937" size="small" style={styles.providerSpinner} />
            ) : (
              <View style={[styles.providerIcon, { backgroundColor: '#F1F5F9' }]}>
                <Text style={styles.githubEmoji}>🐙</Text>
              </View>
            )}
            <Text style={styles.providerLabel}>Continue with GitHub</Text>
          </TouchableOpacity>
        )}
        {twitterEnabled && (
          <TouchableOpacity
            style={styles.providerBtn}
            onPress={() => handleOAuthLogin('twitter')}
            disabled={!!oauthLoading}
            activeOpacity={0.7}
          >
            {oauthLoading === 'twitter' ? (
              <ActivityIndicator color="#1D9BF0" size="small" style={styles.providerSpinner} />
            ) : (
              <View style={[styles.providerIcon, { backgroundColor: '#EFF6FF' }]}>
                <Text style={styles.twitterX}>𝕏</Text>
              </View>
            )}
            <Text style={styles.providerLabel}>Continue with Twitter</Text>
          </TouchableOpacity>
        )}

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or sign in with phone</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Phone / password form */}
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Phone number"
            placeholderTextColor="#A1A1AA"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            inputMode="tel"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#A1A1AA"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {/* Sign In */}
          <TouchableOpacity
            style={[styles.signInBtn, busy && styles.disabled]}
            onPress={handleLogin}
            disabled={busy}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.signInText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Register */}
        <View style={styles.registerRow}>
          <Text style={styles.registerText}>Don't have an account? </Text>
          <Link href="/(auth)/register" asChild>
            <TouchableOpacity>
              <Text style={styles.registerLink}>Sign Up</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  logoChar: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '500',
  },
  providerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 13,
    backgroundColor: '#F8FAFC',
    marginBottom: 10,
  },
  providerIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerSpinner: {
    width: 28,
    height: 28,
  },
  providerLabel: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
  },
  qrGlyph: {
    fontSize: 16,
    color: '#6366F1',
    fontWeight: '700',
  },
  googleG: {
    fontSize: 16,
    color: '#EA4335',
    fontWeight: '700',
  },
  githubEmoji: {
    fontSize: 16,
  },
  twitterX: {
    fontSize: 16,
    color: '#1D9BF0',
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  form: {
    gap: 0,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0F172A',
    marginBottom: 12,
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  forgotLink: {
    color: '#6366F1',
    fontSize: 13,
    fontWeight: '600',
  },
  resendBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 8,
  },
  resendText: {
    color: '#6366F1',
    fontSize: 13,
    fontWeight: '600',
  },
  signInBtn: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  signInText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.6,
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  registerText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  registerLink: {
    color: '#6366F1',
    fontSize: 14,
    fontWeight: '700',
  },
});
