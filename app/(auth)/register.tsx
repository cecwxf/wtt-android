import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Link, router } from 'expo-router';
import { wttApi } from '@/lib/api/wtt-client';
import { useAppTheme } from '@/lib/app-theme';
import { useAuthStore } from '@/stores/auth';
import { useI18nStore } from '@/stores/i18n';

export default function RegisterScreen() {
  const theme = useAppTheme();
  const t = useI18nStore((s) => s.t);
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [codeSending, setCodeSending] = useState(false);
  const [codeStatus, setCodeStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const register = useAuthStore((s) => s.register);
  const login = useAuthStore((s) => s.login);

  const handleSendCode = async () => {
    const normalizedPhone = phone.trim();
    if (!normalizedPhone) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }
    setCodeSending(true);
    try {
      const result = await wttApi.sendPhoneCode(normalizedPhone, 'register');
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

  const handleRegister = async () => {
    const normalizedName = username.trim();
    const normalizedPhone = phone.trim();
    const normalizedCode = code.trim();

    if (!normalizedName || !normalizedPhone || !normalizedCode || !password.trim()) {
      Alert.alert('Error', t.auth.fillAllFields);
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await register(normalizedName, normalizedPhone, normalizedCode, password);
      await login(normalizedPhone, password);
      router.replace('/webview');
    } catch (err: unknown) {
      Alert.alert(
        'Registration Failed',
        err instanceof Error ? err.message : 'Registration failed',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.root, { backgroundColor: theme.background }]}
    >
      <View style={styles.inner}>
        <View style={styles.logoArea}>
          <Text style={[styles.title, { color: theme.accent }]}>WTT</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>{t.auth.createAccount}</Text>
        </View>

        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
          ]}
          placeholder={t.auth.username}
          placeholderTextColor={theme.placeholder}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
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
        <View style={styles.codeRow}>
          <TextInput
            style={[
              styles.codeInput,
              { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
            ]}
            placeholder={t.auth.verificationCode}
            placeholderTextColor={theme.placeholder}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
          />
          <TouchableOpacity
            style={[styles.codeBtn, { borderColor: theme.border }]}
            disabled={codeSending}
            onPress={handleSendCode}
          >
            {codeSending ? (
              <ActivityIndicator color={theme.accent} size="small" />
            ) : (
              <Text style={[styles.codeBtnText, { color: theme.accent }]}>{t.auth.sendCode}</Text>
            )}
          </TouchableOpacity>
        </View>
        {codeStatus ? (
          <Text style={[styles.codeStatus, { color: theme.textSubtle }]}>{codeStatus}</Text>
        ) : null}
        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
          ]}
          placeholder="Password (min 8 chars)"
          placeholderTextColor={theme.placeholder}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[
            styles.signUpButton,
            { backgroundColor: theme.accent },
            loading && styles.disabled,
          ]}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.signUpText}>{t.auth.createAccount}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.loginRow}>
          <Text style={[styles.loginText, { color: theme.textSubtle }]}>{t.auth.hasAccount} </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text style={[styles.loginLink, { color: theme.accent }]}>{t.auth.signIn}</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  logoArea: { alignItems: 'center', marginBottom: 36 },
  title: { fontSize: 36, fontWeight: '800' },
  subtitle: { fontSize: 16, marginTop: 8, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 16,
    marginBottom: 14,
  },
  codeRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  codeInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 16,
  },
  codeBtn: {
    minWidth: 104,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  codeBtnText: { fontSize: 13, fontWeight: '800' },
  codeStatus: { fontSize: 12, marginBottom: 12, textAlign: 'center' },
  signUpButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  signUpText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.7 },
  loginRow: { flexDirection: 'row', justifyContent: 'center' },
  loginText: { fontSize: 14 },
  loginLink: { fontSize: 14, fontWeight: '700' },
});
