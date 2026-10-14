import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { useMe } from '@/lib/queries';
import { colors } from '@/theme';

/** Decides where the app opens: welcome, the placement check, or today's screen. */
export default function Index() {
  const status = useAuth((s) => s.status);
  const me = useMe(status === 'signedIn');

  if (status === 'signedOut') {
    return <Redirect href="/welcome" />;
  }
  if (status === 'signedIn' && me.isError) {
    // Offline with a saved session: open the app anyway, screens show cached data.
    return <Redirect href="/home" />;
  }
  if (status === 'signedIn' && me.data) {
    return <Redirect href={me.data.placementScore === null ? '/placement' : '/home'} />;
  }
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink }}>
      <ActivityIndicator color={colors.yellow} />
    </View>
  );
}
