import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Link, router } from 'expo-router';
import { wttApi } from '@/lib/api/wtt-client';
import { useAppTheme } from '@/lib/app-theme';
import { useI18nStore } from '@/stores/i18n';

export default function ResetPasswordScreen() {
  const theme = useAppTheme();
  const t = useI18nStore((s) => s.t);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [codeSending, setCodeSending] = useState(false);
  const [codeStatus, setCodeStatus] = useState('');
  const [resetting, setResetting] = useState(false);

  const handleSendCode = async () => {
    const normalizedPhone = phone.trim();
    if (!normalizedPhone) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }
    setCodeSending(true);
    try {
      const result = await wttApi.sendPhoneCode(normalizedPhone, 'reset_password');
      setCodeStatus(
        result.debug_code
          ? `${t.auth.codeSent}: ${t.auth.debugCode} ${result.debug_code}`
          : t.auth.codeSent,
      );
    } catch (err: unknown) {
      Alert.alert('Request failed', err instanceof Error ? err.message : 'Request failed');
    } finally {
      setCodeSending(false);
    }
  };

  const handleConfirmReset = async () => {
    const normalizedPhone = phone.trim();
    const normalizedCode = code.trim();
    const password = newPassword.trim();
    if (!normalizedPhone || !normalizedCode || !password) {
      Alert.alert('Error', t.auth.fillAllFields);
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }
    setResetting(true);
    try {
      await wttApi.resetPasswordWithPhone(normalizedPhone, normalizedCode, password);
      Alert.alert('Success', 'Password reset complete, please sign in again', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (err: unknown) {
      Alert.alert('Reset failed', err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setResetting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.root, { backgroundColor: theme.background }]}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <View style={styles.logoArea}>
          <Text style={[styles.title, { color: theme.accent }]}>{t.auth.resetPassword}</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            Use phone verification to set a new password.
          </Text>
        </View>
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
          placeholder={t.auth.newPassword}
          placeholderTextColor={theme.placeholder}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
        />
        <TouchableOpacity
          style={[
            styles.primaryBtn,
            { backgroundColor: theme.accent },
            resetting && styles.disabled,
          ]}
          disabled={resetting}
          onPress={handleConfirmReset}
        >
          {resetting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>{t.auth.resetPassword}</Text>
          )}
        </TouchableOpacity>
        <View style={styles.backRow}>
          <Text style={[styles.backText, { color: theme.textSubtle }]}>{t.auth.hasAccount} </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text style={[styles.backLink, { color: theme.accent }]}>{t.auth.signIn}</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { paddingHorizontal: 28, paddingVertical: 52 },
  logoArea: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { marginTop: 8, fontSize: 13 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  codeRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  codeInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
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
  primaryBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.7 },
  backRow: { marginTop: 26, flexDirection: 'row', justifyContent: 'center' },
  backText: { fontSize: 13 },
  backLink: { fontSize: 13, fontWeight: '800' },
});
