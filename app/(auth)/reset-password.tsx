import { useMemo, useState } from 'react';
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
import { Link, router, useLocalSearchParams } from 'expo-router';
import { wttApi } from '@/lib/api/wtt-client';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const initialToken = useMemo(() => {
    if (!params.token) return '';
    return Array.isArray(params.token) ? params.token[0] || '' : params.token;
  }, [params.token]);

  const [email, setEmail] = useState('');
  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState('');

  const [requesting, setRequesting] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleRequestReset = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    setRequesting(true);
    try {
      await wttApi.requestPasswordReset(normalizedEmail);
      Alert.alert('Done', 'Reset link has been sent if the email exists');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Request failed';
      Alert.alert('Request failed', message);
    } finally {
      setRequesting(false);
    }
  };

  const handleConfirmReset = async () => {
    const resetToken = token.trim();
    const password = newPassword.trim();

    if (!resetToken || !password) {
      Alert.alert('Error', 'Please fill token and new password');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    setResetting(true);
    try {
      await wttApi.confirmPasswordReset(resetToken, password);
      Alert.alert('Success', 'Password reset complete, please sign in again', [
        {
          text: 'OK',
          onPress: () => router.replace('/(auth)/login'),
        },
      ]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Reset failed';
      Alert.alert('Reset failed', message);
    } finally {
      setResetting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.root}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <View style={styles.logoArea}>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>Request reset email or submit token + new password</Text>
        </View>

        <Text style={styles.sectionTitle}>1) Request reset link</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#9CA3AF"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TouchableOpacity
          style={[styles.primaryBtn, requesting && styles.disabled]}
          disabled={requesting}
          onPress={handleRequestReset}
        >
          {requesting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Send Reset Link</Text>
          )}
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { marginTop: 22 }]}>2) Confirm reset</Text>
        <TextInput
          style={styles.input}
          placeholder="Reset token"
          placeholderTextColor="#9CA3AF"
          value={token}
          onChangeText={setToken}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="New password"
          placeholderTextColor="#9CA3AF"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
        />
        <TouchableOpacity
          style={[styles.primaryBtn, resetting && styles.disabled]}
          disabled={resetting}
          onPress={handleConfirmReset}
        >
          {resetting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Reset Password</Text>
          )}
        </TouchableOpacity>

        <View style={styles.backRow}>
          <Text style={styles.backText}>Remembered your password? </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text style={styles.backLink}>Back to Sign In</Text>
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
    backgroundColor: '#F8FAFC',
  },
  inner: {
    paddingHorizontal: 28,
    paddingVertical: 36,
  },
  logoArea: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#6366F1',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 13,
    color: '#6B7280',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    marginBottom: 10,
  },
  primaryBtn: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 2,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.7,
  },
  backRow: {
    marginTop: 26,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 13,
    color: '#64748B',
  },
  backLink: {
    fontSize: 13,
    color: '#4F46E5',
    fontWeight: '700',
  },
});
