import { useRouter } from 'expo-router';

import { Onboarding } from '@/components/Onboarding';

/** A way to reopen the onboarding flow just to look at it — doesn't touch
 *  profile.onboarded, unlike the real first-run flow in _layout.tsx. */
export default function OnboardingPreviewScreen() {
  const router = useRouter();
  return <Onboarding onFinish={() => router.back()} />;
}
