import { useSignIn, useSignUp } from '@clerk/clerk-expo';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { T, radius } from '@/lib/theme';

type Mode = 'signIn' | 'signUp' | 'verify';

/** Email + password auth, with Clerk's email-code verification step on signup. */
export function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { isLoaded: signInLoaded, signIn, setActive: setActiveFromSignIn } = useSignIn();
  const { isLoaded: signUpLoaded, signUp, setActive: setActiveFromSignUp } = useSignUp();

  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const swap = (next: Mode) => {
    setError(null);
    setMode(next);
  };

  const handleSignIn = async () => {
    if (!signInLoaded) return;
    setBusy(true);
    setError(null);
    try {
      const result = await signIn.create({ identifier: email.trim(), password });
      if (result.status === 'complete') {
        await setActiveFromSignIn({ session: result.createdSessionId });
      } else {
        setError("Couldn't sign in. Double-check your email and password.");
      }
    } catch (err) {
      setError(clerkMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async () => {
    if (!signUpLoaded) return;
    setBusy(true);
    setError(null);
    try {
      await signUp.create({ emailAddress: email.trim(), password });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setMode('verify');
    } catch (err) {
      setError(clerkMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    if (!signUpLoaded) return;
    setBusy(true);
    setError(null);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (result.status === 'complete') {
        await setActiveFromSignUp({ session: result.createdSessionId });
      } else {
        setError('That code didn’t work. Check your email and try again.');
      }
    } catch (err) {
      setError(clerkMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submit = mode === 'signIn' ? handleSignIn : mode === 'signUp' ? handleSignUp : handleVerify;
  const canSubmit =
    mode === 'verify' ? code.trim().length > 0 : email.trim().length > 0 && password.length >= 8;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 40 }]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.art}>
          {['#E2574C', '#E8B04B', '#3F8F6F', '#2F6DB0'].map((hex) => (
            <View key={hex} style={[styles.swatch, { backgroundColor: hex }]} />
          ))}
        </View>

        <Text style={styles.title}>Swatchy</Text>
        <Text style={styles.subtitle}>
          {mode === 'verify'
            ? `Enter the code we sent to ${email.trim()}`
            : 'Pull colors out of photos, name them, share them.'}
        </Text>

        <View style={styles.form}>
          {mode !== 'verify' ? (
            <>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={T.textFaint}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
              />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Password (min. 8 characters)"
                placeholderTextColor={T.textFaint}
                style={styles.input}
                secureTextEntry
                textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
                returnKeyType="go"
                onSubmitEditing={() => canSubmit && submit()}
              />
            </>
          ) : (
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="6-digit code"
              placeholderTextColor={T.textFaint}
              style={styles.input}
              keyboardType="number-pad"
              autoFocus
              returnKeyType="go"
              onSubmitEditing={() => canSubmit && submit()}
            />
          )}

          {!!error && <Text style={styles.error}>{error}</Text>}

          {busy ? (
            <ActivityIndicator color={T.text} style={styles.spinner} />
          ) : (
            <Button
              label={mode === 'signIn' ? 'Sign in' : mode === 'signUp' ? 'Create account' : 'Verify'}
              onPress={submit}
              disabled={!canSubmit}
            />
          )}
        </View>

        {mode === 'signIn' && (
          <Pressable onPress={() => swap('signUp')} hitSlop={8} style={styles.switchRow}>
            <Text style={styles.switchText}>
              New here? <Text style={styles.switchLink}>Create an account</Text>
            </Text>
          </Pressable>
        )}
        {mode === 'signUp' && (
          <Pressable onPress={() => swap('signIn')} hitSlop={8} style={styles.switchRow}>
            <Text style={styles.switchText}>
              Already have an account? <Text style={styles.switchLink}>Sign in</Text>
            </Text>
          </Pressable>
        )}
        {mode === 'verify' && (
          <Pressable onPress={() => swap('signUp')} hitSlop={8} style={styles.switchRow}>
            <Text style={styles.switchText}>
              Wrong email? <Text style={styles.switchLink}>Go back</Text>
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Clerk errors carry a structured `.errors[]`; fall back to a generic message. */
function clerkMessage(err: unknown): string {
  const errors = (err as { errors?: { message?: string }[] })?.errors;
  return errors?.[0]?.message ?? 'Something went wrong. Try again.';
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  content: { flexGrow: 1, paddingHorizontal: 28, paddingBottom: 40 },

  art: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  swatch: { width: 40, height: 58, borderRadius: radius.sm },

  title: { color: T.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: T.textFaint, fontSize: 14, marginTop: 8, lineHeight: 20, maxWidth: 300 },

  form: { marginTop: 32, gap: 12 },
  input: {
    height: 50,
    borderRadius: radius.md,
    backgroundColor: T.surfaceHi,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    color: T.text,
    fontSize: 16,
    paddingHorizontal: 14,
  },
  error: { color: T.danger, fontSize: 13, lineHeight: 18 },
  spinner: { marginTop: 6 },

  switchRow: { marginTop: 20, alignSelf: 'center' },
  switchText: { color: T.textFaint, fontSize: 14 },
  switchLink: { color: T.text, fontWeight: '700' },
});
