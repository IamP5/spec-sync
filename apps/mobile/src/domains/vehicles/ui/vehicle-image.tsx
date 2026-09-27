import { Image } from 'expo-image';
import { CarFront } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon } from '../../../design-system/components/ui/icon';
import { Text } from '../../../design-system/components/ui/text';
import { cn } from '../../../design-system/lib/utils';
import type { VehicleImageMetadata } from '../data/vehicle-contracts';

/**
 * A vehicle photo on a muted surface (web `VehicleImage`): the published
 * image, an "Illustrative image" tag when it does not show the exact
 * configuration, and a car icon when there is no photo or it fails to load.
 * The caller sizes the frame through `className`.
 */
export function VehicleImage({
  image,
  compact = false,
  className,
  iconClassName,
}: {
  image?: VehicleImageMetadata | null;
  /** Small frames keep the illustrative tag for screen readers only. */
  compact?: boolean;
  className?: string;
  iconClassName?: string;
}) {
  // The failure belongs to one URL: a different image is tried again.
  const [failedUrl, setFailedUrl] = useState<string>();
  const photo = image && image.url !== failedUrl ? image : undefined;
  const illustrative = photo?.matchScope === 'ILLUSTRATIVE';
  return (
    <View className={cn('bg-muted overflow-hidden', className)}>
      {photo ? (
        <>
          <Image
            source={{ uri: photo.url }}
            alt={photo.altText}
            accessibilityLabel={
              illustrative
                ? `${photo.altText} (illustrative image)`
                : photo.altText
            }
            contentFit="cover"
            transition={150}
            style={StyleSheet.absoluteFill}
            onError={() => setFailedUrl(photo.url)}
          />
          {illustrative && !compact ? (
            <View
              className="bg-background/90 absolute bottom-1 left-1 rounded-xs px-1.5 py-0.5"
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
            >
              <Text className="text-foreground text-xs">
                Illustrative image
              </Text>
            </View>
          ) : null}
        </>
      ) : (
        <View
          className="absolute inset-0 items-center justify-center"
          accessible
          accessibilityRole="image"
          accessibilityLabel="Vehicle image not available"
        >
          <Icon
            as={CarFront}
            className={cn('text-muted-foreground size-6', iconClassName)}
          />
        </View>
      )}
    </View>
  );
}
