import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuthStore } from '@/stores/auth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      Alert.alert('Login Failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background-light dark:bg-background-dark"
      style={styles.root}
    >
      <View className="flex-1 justify-center px-8" style={styles.inner}>
        {/* Logo */}
        <View className="items-center mb-12" style={styles.logoArea}>
          <Text className="text-4xl font-inter-bold text-primary" style={styles.title}>
            WTT
          </Text>
          <Text
            className="text-base text-gray-500 dark:text-gray-400 mt-2 font-inter"
            style={styles.subtitle}
          >
            Want To Talk
          </Text>
        </View>

        {/* Email */}
        <Text
          className="text-sm font-inter text-gray-600 dark:text-gray-400 mb-1 ml-1"
          style={styles.label}
        >
          Email
        </Text>
        <TextInput
          className="bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-base text-gray-900 dark:text-gray-100 mb-4 font-inter"
          style={styles.input}
          placeholder="you@example.com"
          placeholderTextColor="#9CA3AF"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        {/* Password */}
        <Text
          className="text-sm font-inter text-gray-600 dark:text-gray-400 mb-1 ml-1"
          style={styles.label}
        >
          Password
        </Text>
        <TextInput
          className="bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-base text-gray-900 dark:text-gray-100 mb-2 font-inter"
          style={styles.passwordInput}
          placeholder="Password"
          placeholderTextColor="#9CA3AF"
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

        {/* Login Button */}
        <TouchableOpacity
          className="bg-primary rounded-xl py-4 items-center mb-4"
          style={styles.signInButton}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-white text-base font-inter-semibold" style={styles.signInText}>
              Sign In
            </Text>
          )}
        </TouchableOpacity>

        {/* OAuth Buttons */}
        <View className="flex-row gap-3 mb-6" style={styles.oauthRow}>
          <TouchableOpacity
            className="flex-1 bg-gray-900 dark:bg-zinc-700 rounded-xl py-3 items-center"
            style={styles.githubButton}
          >
            <Text className="text-white font-inter text-sm" style={styles.oauthText}>
              GitHub
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-red-500 rounded-xl py-3 items-center"
            style={styles.googleButton}
          >
            <Text className="text-white font-inter text-sm" style={styles.oauthText}>
              Google
            </Text>
          </TouchableOpacity>
        </View>

        {/* Register Link */}
        <View className="flex-row justify-center" style={styles.registerRow}>
          <Text
            className="text-gray-500 dark:text-gray-400 font-inter text-sm"
            style={styles.registerText}
          >
            Don&apos;t have an account?{' '}
          </Text>
          <Link href="/(auth)/register" asChild>
            <TouchableOpacity>
              <Text
                className="text-primary font-inter-semibold text-sm"
                style={styles.registerLink}
              >
                Sign Up
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#6366F1',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 8,
  },
  label: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    marginBottom: 16,
  },
  passwordInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    marginBottom: 8,
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginBottom: 18,
  },
  forgotLink: {
    color: '#6366F1',
    fontSize: 13,
    fontWeight: '600',
  },
  signInButton: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  signInText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  oauthRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  githubButton: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  googleButton: {
    flex: 1,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  oauthText: {
    color: '#fff',
    fontSize: 14,
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  registerText: {
    color: '#6B7280',
    fontSize: 14,
  },
  registerLink: {
    color: '#6366F1',
    fontSize: 14,
    fontWeight: '600',
  },
});
