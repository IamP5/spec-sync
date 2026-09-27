import { View } from 'react-native';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '../../../design-system/components/ui/avatar';
import { Skeleton } from '../../../design-system/components/ui/skeleton';
import { Text } from '../../../design-system/components/ui/text';
import { initialsOf } from '../data/preferences';
import { useUserDetailStore } from './user-detail-store';

/** The account card: Google photo or initials, name and email (web `UserProfileOverview`). */
export function UserProfileOverview() {
  const profile = useUserDetailStore();

  if (profile.loading) {
    return (
      <View
        className="flex-row items-center gap-3"
        accessibilityLabel="Loading your account…"
      >
        <Skeleton className="size-11 rounded-full" />
        <View className="flex-1 gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-44" />
        </View>
      </View>
    );
  }
  if (!profile.user) {
    return profile.failed ? (
      <Text className="text-muted-foreground text-sm">
        Profile unavailable.
      </Text>
    ) : null;
  }
  const { user } = profile;
  const name = user.displayName || 'User';
  return (
    <View className="flex-row items-center gap-3">
      <Avatar alt={name} className="size-11">
        {user.photoUrl ? <AvatarImage source={{ uri: user.photoUrl }} /> : null}
        <AvatarFallback>
          <Text className="text-sm font-medium">{initialsOf(name)}</Text>
        </AvatarFallback>
      </Avatar>
      <View className="flex-1">
        <Text className="font-medium" numberOfLines={1}>
          {name}
        </Text>
        <Text className="text-muted-foreground text-sm" numberOfLines={1}>
          {user.email}
        </Text>
      </View>
    </View>
  );
}
