import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { Body, Button, ErrorNote, Label, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { messageFor } from '@/lib/errors';
import { colors, fonts } from '@/theme';

export default function Auth() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<'register' | 'login'>(params.mode === 'login' ? 'login' : 'register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const register = useAuth((s) => s.register);
  const login = useAuth((s) => s.login);

  const isRegister = mode === 'register';
  const valid = email.includes('@') && password.length >= 8 && (!isRegister || name.trim().length > 0);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (isRegister) {
        await register(name.trim(), email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
      router.replace('/');
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable accessibilityRole="button" accessibilityLabel="Geri" onPress={() => router.back()} style={styles.back}>
            <Icon name="arrowLeft" size={20} />
          </Pressable>
          <Title size={32}>{isRegister ? 'Hesabını oluştur' : 'Tekrar hoş geldin'}</Title>
          <Body color={colors.muted}>
            {isRegister ? 'İlerlemen, serin ve pasaport damgaların hesabında saklanır.' : 'Kaldığın yerden devam et.'}
          </Body>

          {isRegister ? (
            <Field label="ADIN" value={name} onChangeText={setName} autoComplete="name" textContentType="givenName" />
          ) : null}
          <Field
            label="E-POSTA"
            value={email}
            onChangeText={setEmail}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <Field
            label="ŞİFRE"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            textContentType={isRegister ? 'newPassword' : 'password'}
            note={isRegister ? 'En az 8 karakter' : undefined}
          />

          <ErrorNote message={error} />
          <Button label={isRegister ? 'Hesap oluştur' : 'Giriş yap'} onPress={submit} disabled={!valid} loading={busy} />
          <Button
            label={isRegister ? 'Zaten hesabım var' : 'Yeni hesap oluştur'}
            variant="ghost"
            onPress={() => {
              setError(null);
              setMode(isRegister ? 'login' : 'register');
            }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type FieldProps = React.ComponentProps<typeof TextInput> & { label: string; note?: string };

function Field({ label, note, ...input }: FieldProps) {
  return (
    <View style={{ gap: 6 }}>
      <Label>{label}</Label>
      <TextInput
        {...input}
        accessibilityLabel={label}
        autoCapitalize={input.secureTextEntry || input.keyboardType === 'email-address' ? 'none' : 'words'}
        style={styles.input}
        placeholderTextColor={colors.muted}
      />
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: { padding: 20, gap: 16 },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  input: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: colors.ink,
  },
  note: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
});
