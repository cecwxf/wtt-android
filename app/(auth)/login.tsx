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
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/stores/auth';
import {
  getOAuthRedirectUri,
  isOAuthProviderEnabled,
  startOAuthCodeFlow,
  type OAuthProvider,
} from '@/lib/auth/oauth';

export default function LoginScreen() {
  const params = useLocalSearchParams<{ email?: string; activation_hint?: string }>();
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const [resendingActivation, setResendingActivation] = useState(false);
  const [showResend, setShowResend] = useState(params.activation_hint === '1');
  const login = useAuthStore((s) => s.login);
  const loginWithOAuth = useAuthStore((s) => s.loginWithOAuth);
  const resendActivation = useAuthStore((s) => s.resendActivation);
  const githubEnabled = isOAuthProviderEnabled('github');
  const googleEnabled = isOAuthProviderEnabled('google');
  const twitterEnabled = isOAuthProviderEnabled('twitter');
  const anyOAuth = githubEnabled || googleEnabled || twitterEnabled;

  const handleLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      await login(normalizedEmail, password);
      router.replace('/webview');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      if (message.includes('EMAIL_NOT_VERIFIED')) {
        setShowResend(true);
        Alert.alert(
          'Email not activated',
          'Please activate your email first. Need to resend?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Resend',
              onPress: async () => {
                try {
                  setResendingActivation(true);
                  const data = await resendActivation(normalizedEmail);
                  Alert.alert('Done', data?.message || 'Activation email sent');
                } catch (e: unknown) {
                  const msg = e instanceof Error ? e.message : 'Failed to resend';
                  Alert.alert('Resend failed', msg);
                } finally {
                  setResendingActivation(false);
                }
              },
            },
          ],
        );
      } else {
        Alert.alert('Login Failed', message);
      }
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

  const handleResendActivation = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      Alert.alert('Error', 'Please enter your email first');
      return;
    }
    setResendingActivation(true);
    try {
      const data = await resendActivation(normalizedEmail);
      Alert.alert('Done', data?.message || 'Activation email sent');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to resend';
      Alert.alert('Resend failed', message);
    } finally {
      setResendingActivation(false);
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

        {/* QR Login — top */}
        <TouchableOpacity
          style={styles.providerBtn}
          onPress={() => router.push('/(auth)/qr-login' as never)}
          disabled={busy}
          activeOpacity={0.7}
        >
          <View style={[styles.providerIcon, { backgroundColor: '#EEF2FF' }]}>
            <Text style={styles.qrGlyph}>⎔</Text>
          </View>
          <Text style={styles.providerLabel}>Scan QR Code</Text>
        </TouchableOpacity>

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
          <Text style={styles.dividerText}>or sign in with email</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Email / password form */}
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#A1A1AA"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
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

          <View style={styles.forgotRow}>
            <Link href="/(auth)/reset-password" asChild>
              <TouchableOpacity>
                <Text style={styles.forgotLink}>Forgot password?</Text>
              </TouchableOpacity>
            </Link>
          </View>

          {/* Resend activation — only when needed */}
          {showResend && !!email.trim() && (
            <TouchableOpacity
              style={styles.resendBtn}
              onPress={handleResendActivation}
              disabled={resendingActivation || busy}
              activeOpacity={0.8}
            >
              {resendingActivation ? (
                <ActivityIndicator color="#6366F1" size="small" />
              ) : (
                <Text style={styles.resendText}>Resend activation email</Text>
              )}
            </TouchableOpacity>
          )}

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
