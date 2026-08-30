import { useSignIn, useSignUp, useSSO } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
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

// Required once, wherever an OAuth flow might be initiated: lets the
// browser tab Clerk opens for Google's consent screen hand control back to
// this app when it redirects to our scheme, instead of stranding the tab.
WebBrowser.maybeCompleteAuthSession();

/** Preloads the native browser so the Google sheet opens faster — mainly helps Android. */
function useWarmUpBrowser() {
  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}

type Mode = 'signIn' | 'signUp' | 'verify' | 'forgotEmail' | 'forgotReset';

/**
 * Email + password auth, with Clerk's email-code verification step on
 * signup and its email-code reset flow for a forgotten password. Both
 * verification steps share the same two-stage shape: request a code by
 * email, then come back and attempt it — reset just adds a new password to
 * the second stage. Google is a single extra button up top, using Clerk's
 * own hosted OAuth flow (a browser tab it manages) rather than the native
 * Google Sign-In SDK.
 */
export function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { isLoaded: signInLoaded, signIn, setActive: setActiveFromSignIn } = useSignIn();
  const { isLoaded: signUpLoaded, signUp, setActive: setActiveFromSignUp } = useSignUp();
  const { startSSOFlow } = useSSO();
  useWarmUpBrowser();

  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
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

  const handleRequestReset = async () => {
    if (!signInLoaded) return;
    setBusy(true);
    setError(null);
    try {
      await signIn.create({ identifier: email.trim(), strategy: 'reset_password_email_code' });
      setCode('');
      setNewPassword('');
      setMode('forgotReset');
    } catch (err) {
      setError(clerkMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    if (!signInLoaded) return;
    setBusy(true);
    setError(null);
    try {
      const attempt = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: code.trim(),
      });
      if (attempt.status !== 'needs_new_password') {
        setError('That code didn’t work. Check your email and try again.');
        return;
      }
      const result = await signIn.resetPassword({
        password: newPassword,
        signOutOfOtherSessions: true,
      });
      if (result.status === 'complete') {
        await setActiveFromSignIn({ session: result.createdSessionId });
      } else {
        setError('Something went wrong resetting your password. Try again.');
      }
    } catch (err) {
      setError(clerkMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setBusy(true);
    try {
      const redirectUrl = Linking.createURL('/sso-callback');
      console.log('[google sso] redirectUrl', redirectUrl);
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl,
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
      // A null createdSessionId with no error means the browser tab was
      // dismissed without finishing — nothing went wrong, just nothing to do.
    } catch (err) {
      setError(clerkMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submit =
    mode === 'signIn'
      ? handleSignIn
      : mode === 'signUp'
        ? handleSignUp
        : mode === 'verify'
          ? handleVerify
          : mode === 'forgotEmail'
            ? handleRequestReset
            : handleReset;

  const canSubmit =
    mode === 'verify'
      ? code.trim().length > 0
      : mode === 'forgotEmail'
        ? email.trim().length > 0
        : mode === 'forgotReset'
          ? code.trim().length > 0 && newPassword.length >= 8
          : email.trim().length > 0 && password.length >= 8;

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
            : mode === 'forgotEmail'
              ? 'Enter your email and we’ll send you a code to reset your password.'
              : mode === 'forgotReset'
                ? `Enter the code we sent to ${email.trim()}, and a new password.`
                : 'Pull colors out of photos, name them, share them.'}
        </Text>

        <View style={styles.form}>
          {(mode === 'signIn' || mode === 'signUp') && (
            <>
              <Pressable
                onPress={handleGoogle}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Continue with Google"
                style={({ pressed }) => [styles.google, { opacity: busy ? 0.6 : pressed ? 0.8 : 1 }]}>
                <Ionicons name="logo-google" size={17} color={T.text} />
                <Text style={styles.googleText}>Continue with Google</Text>
              </Pressable>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

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
              {mode === 'signIn' && (
                <Pressable
                  onPress={() => swap('forgotEmail')}
                  hitSlop={8}
                  style={styles.forgotRow}>
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </Pressable>
              )}
            </>
          )}

          {mode === 'verify' && (
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

          {mode === 'forgotEmail' && (
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
              autoFocus
              returnKeyType="go"
              onSubmitEditing={() => canSubmit && submit()}
            />
          )}

          {mode === 'forgotReset' && (
            <>
              <TextInput
                value={code}
                onChangeText={setCode}
                placeholder="6-digit code"
                placeholderTextColor={T.textFaint}
                style={styles.input}
                keyboardType="number-pad"
                autoFocus
              />
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="New password (min. 8 characters)"
                placeholderTextColor={T.textFaint}
                style={styles.input}
                secureTextEntry
                textContentType="newPassword"
                returnKeyType="go"
                onSubmitEditing={() => canSubmit && submit()}
              />
            </>
          )}

          {!!error && <Text style={styles.error}>{error}</Text>}

          {busy ? (
            <ActivityIndicator color={T.text} style={styles.spinner} />
          ) : (
            <Button
              label={
                mode === 'signIn'
                  ? 'Sign in'
                  : mode === 'signUp'
                    ? 'Create account'
                    : mode === 'verify'
                      ? 'Verify'
                      : mode === 'forgotEmail'
                        ? 'Send code'
                        : 'Reset password'
              }
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
        {(mode === 'forgotEmail' || mode === 'forgotReset') && (
          <Pressable onPress={() => swap('signIn')} hitSlop={8} style={styles.switchRow}>
            <Text style={styles.switchText}>
              Remember it after all? <Text style={styles.switchLink}>Back to sign in</Text>
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
  google: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 50,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
  },
  googleText: { color: T.text, fontSize: 15, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 2 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: T.border },
  dividerText: { color: T.textFaint, fontSize: 12, fontWeight: '600' },
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

  forgotRow: { alignSelf: 'flex-end', marginTop: -4 },
  forgotText: { color: T.textDim, fontSize: 13, fontWeight: '600' },

  switchRow: { marginTop: 20, alignSelf: 'center' },
  switchText: { color: T.textFaint, fontSize: 14 },
  switchLink: { color: T.text, fontWeight: '700' },
});
