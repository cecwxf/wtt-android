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
import { wttApi } from '@/lib/api/wtt-client';
import { useAppTheme } from '@/lib/app-theme';
import { useI18nStore } from '@/stores/i18n';
import { useThemeStore } from '@/stores/theme';
import {
  getOAuthRedirectUri,
  isOAuthProviderEnabled,
  startOAuthCodeFlow,
  type OAuthProvider,
} from '@/lib/auth/oauth';

export default function LoginScreen() {
  const theme = useAppTheme();
  const t = useI18nStore((s) => s.t);
  const locale = useI18nStore((s) => s.locale);
  const setLocale = useI18nStore((s) => s.setLocale);
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [loginMode, setLoginMode] = useState<'password' | 'code'>('password');
  const [codeSending, setCodeSending] = useState(false);
  const [codeStatus, setCodeStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const login = useAuthStore((s) => s.login);
  const loginWithPhoneCode = useAuthStore((s) => s.loginWithPhoneCode);
  const loginWithOAuth = useAuthStore((s) => s.loginWithOAuth);
  const githubEnabled = isOAuthProviderEnabled('github');
  const googleEnabled = isOAuthProviderEnabled('google');
  const twitterEnabled = isOAuthProviderEnabled('twitter');

  const handleLogin = async () => {
    const normalizedPhone = phone.trim();
    if (!normalizedPhone || (loginMode === 'password' ? !password.trim() : !code.trim())) {
      Alert.alert('Error', t.auth.fillAllFields);
      return;
    }
    setLoading(true);
    try {
      if (loginMode === 'password') {
        await login(normalizedPhone, password);
      } else {
        await loginWithPhoneCode(normalizedPhone, code);
      }
      router.replace('/webview');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      Alert.alert('Login Failed', message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendCode = async () => {
    const normalizedPhone = phone.trim();
    if (!normalizedPhone) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }
    setCodeSending(true);
    try {
      const result = await wttApi.sendPhoneCode(normalizedPhone, 'login');
      setCodeStatus(
        result.debug_code
          ? `${t.auth.codeSent}: ${t.auth.debugCode} ${result.debug_code}`
          : t.auth.codeSent,
      );
    } catch (err: unknown) {
      Alert.alert('Code failed', err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setCodeSending(false);
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
      style={[styles.root, { backgroundColor: theme.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={styles.prefRow}>
          <TouchableOpacity
            style={[
              styles.prefPill,
              { borderColor: theme.border, backgroundColor: theme.surfaceAlt },
            ]}
            onPress={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
          >
            <Text style={[styles.prefText, { color: theme.text }]}>
              {locale === 'zh' ? '中文' : 'EN'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.prefPill,
              { borderColor: theme.border, backgroundColor: theme.surfaceAlt },
            ]}
            onPress={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
          >
            <Text style={[styles.prefText, { color: theme.text }]}>
              {theme.dark ? t.profile.dark : t.profile.light}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Logo */}
        <View style={styles.logoArea}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoChar}>W</Text>
          </View>
          <Text style={[styles.appName, { color: theme.text }]}>WTT</Text>
          <Text style={[styles.tagline, { color: theme.textMuted }]}>{t.auth.agentPlatform}</Text>
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
            <Text style={[styles.providerLabel, { color: theme.text }]}>
              {t.auth.continueWithGoogle}
            </Text>
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
            <Text style={[styles.providerLabel, { color: theme.text }]}>
              {t.auth.continueWithGithub}
            </Text>
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
            <Text style={[styles.providerLabel, { color: theme.text }]}>
              {t.auth.continueWithTwitter}
            </Text>
          </TouchableOpacity>
        )}

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={[styles.dividerText, { color: theme.textSubtle }]}>
            {t.auth.signInWithPhoneEmail}
          </Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Phone / password form */}
        <View style={styles.form}>
          <View style={[styles.modeRow, { backgroundColor: theme.surfaceMuted }]}>
            {[
              ['password', t.auth.phonePasswordLogin],
              ['code', t.auth.phoneCodeLogin],
            ].map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={[styles.modeBtn, loginMode === key && { backgroundColor: theme.surface }]}
                onPress={() => setLoginMode(key as 'password' | 'code')}
              >
                <Text
                  style={[
                    styles.modeText,
                    { color: loginMode === key ? theme.accent : theme.textSubtle },
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: theme.surfaceAlt, borderColor: theme.border, color: theme.text },
            ]}
            placeholder={t.auth.phoneOrEmail}
            placeholderTextColor={theme.placeholder}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            inputMode="tel"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={[
              styles.input,
              { backgroundColor: theme.surfaceAlt, borderColor: theme.border, color: theme.text },
            ]}
            placeholder={loginMode === 'password' ? t.auth.password : t.auth.verificationCode}
            placeholderTextColor={theme.placeholder}
            value={loginMode === 'password' ? password : code}
            onChangeText={loginMode === 'password' ? setPassword : setCode}
            secureTextEntry={loginMode === 'password'}
            keyboardType={loginMode === 'code' ? 'number-pad' : 'default'}
          />
          {loginMode === 'code' ? (
            <>
              <TouchableOpacity
                style={[styles.codeBtn, { borderColor: theme.border }]}
                disabled={codeSending}
                onPress={handleSendCode}
              >
                {codeSending ? (
                  <ActivityIndicator color={theme.accent} size="small" />
                ) : (
                  <Text style={[styles.codeBtnText, { color: theme.accent }]}>
                    {t.auth.sendCode}
                  </Text>
                )}
              </TouchableOpacity>
              {codeStatus ? (
                <Text style={[styles.codeStatus, { color: theme.textSubtle }]}>{codeStatus}</Text>
              ) : null}
            </>
          ) : (
            <View style={styles.forgotRow}>
              <Link href="/(auth)/reset-password" asChild>
                <TouchableOpacity>
                  <Text style={[styles.forgotLink, { color: theme.accent }]}>
                    {t.auth.forgotPassword}
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>
          )}

          {/* Sign In */}
          <TouchableOpacity
            style={[styles.signInBtn, { backgroundColor: theme.accent }, busy && styles.disabled]}
            onPress={handleLogin}
            disabled={busy}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.signInText}>{t.auth.signIn}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Register */}
        <View style={styles.registerRow}>
          <Text style={[styles.registerText, { color: theme.textSubtle }]}>
            {t.auth.noAccount}{' '}
          </Text>
          <Link href="/(auth)/register" asChild>
            <TouchableOpacity>
              <Text style={[styles.registerLink, { color: theme.accent }]}>{t.auth.signUp}</Text>
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
  prefRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginBottom: 18,
  },
  prefPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  prefText: {
    fontSize: 12,
    fontWeight: '700',
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
  modeRow: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  modeBtn: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 10,
    paddingVertical: 9,
  },
  modeText: {
    fontSize: 13,
    fontWeight: '800',
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
  codeBtn: {
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 10,
  },
  codeBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  codeStatus: {
    fontSize: 12,
    marginBottom: 12,
    textAlign: 'center',
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
