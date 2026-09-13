import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { useStore } from '@/lib/store';
import { T, radius } from '@/lib/theme';
import {
  USERNAME_MAX,
  USERNAME_MIN,
  normalizeUsername,
  usernameErrorMessage,
  usernameProblem,
} from '@/lib/username';

/**
 * Asks someone to choose their username before anything else. Every account
 * starts with a generated one (swatcher + digits) rather than anything taken
 * from their name or email; this is where they replace it — or keep it, which
 * counts as choosing too.
 */
export function UsernamePicker() {
  const insets = useSafeAreaInsets();
  const { profile, renameProfile } = useStore();

  const [value, setValue] = useState(profile.name);
  const [edited, setEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const problem = usernameProblem(value);
  // Format problems only once they've started typing; a rejection from the
  // server (taken, reserved) as soon as it comes back.
  const error = serverError ?? (edited ? problem : null);

  const submit = async () => {
    if (problem || busy) return;
    setBusy(true);
    setServerError(null);
    try {
      await renameProfile(value);
      // On success profile.usernameSet flips and the root gate moves past this screen.
    } catch (err) {
      setServerError(usernameErrorMessage(err));
      setBusy(false);
    }
  };

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

        <Text style={styles.title}>Pick a username</Text>
        <Text style={styles.subtitle}>
          It’s how people see you on posts and the leaderboard. Nobody else can have it.
        </Text>

        <View style={styles.form}>
          <View style={[styles.field, !!error && styles.fieldError]}>
            <Text style={styles.at}>@</Text>
            <TextInput
              value={value}
              onChangeText={(text) => {
                setValue(normalizeUsername(text));
                setEdited(true);
                setServerError(null);
              }}
              style={styles.input}
              autoFocus
              selectTextOnFocus
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              maxLength={USERNAME_MAX}
              returnKeyType="done"
              onSubmitEditing={submit}
              accessibilityLabel="Username"
            />
          </View>

          <Text style={error ? styles.error : styles.hint}>
            {error ??
              `${USERNAME_MIN}–${USERNAME_MAX} characters: letters, numbers, periods and underscores.`}
          </Text>

          <Button label="Continue" onPress={submit} disabled={!!problem} busy={busy} />

          <Text style={styles.footnote}>You can change it later from your profile.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  content: { flexGrow: 1, paddingHorizontal: 28, paddingBottom: 40 },

  art: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  swatch: { width: 40, height: 58, borderRadius: radius.sm },

  title: { color: T.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: T.textFaint, fontSize: 14, marginTop: 8, lineHeight: 20, maxWidth: 300 },

  form: { marginTop: 32, gap: 12 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: radius.md,
    backgroundColor: T.surfaceHi,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    paddingHorizontal: 14,
  },
  fieldError: { borderColor: T.danger },
  at: { color: T.textFaint, fontSize: 16, marginRight: 2 },
  input: { flex: 1, color: T.text, fontSize: 16, height: '100%' },

  hint: { color: T.textFaint, fontSize: 13, lineHeight: 18 },
  error: { color: T.danger, fontSize: 13, lineHeight: 18 },
  footnote: { color: T.textFaint, fontSize: 12, textAlign: 'center', marginTop: 4 },
});
