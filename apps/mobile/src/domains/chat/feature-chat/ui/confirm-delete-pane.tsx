import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../design-system/components/ui/alert-dialog';
import { Text } from '../../../../design-system/components/ui/text';

/** A destructive confirmation (web confirm dialogs for deleting conversations). */
export function ConfirmDeletePane({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  portalHost,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  /** The `PortalHost` of the modal screen the dialog opens from. */
  portalHost?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <AlertDialogContent portalHost={portalHost}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onPress={onCancel} accessibilityLabel="Cancel">
            <Text>Cancel</Text>
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive"
            onPress={onConfirm}
            accessibilityLabel={confirmLabel}
          >
            <Text className="text-white">{confirmLabel}</Text>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
