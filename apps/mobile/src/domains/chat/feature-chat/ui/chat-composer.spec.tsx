import { fireEvent, render, screen } from '@testing-library/react-native';

import { Text } from '../../../../design-system/components/ui/text';
import { ChatComposer } from './chat-composer';

// The composer animates through Reanimated, whose native part jest lacks.
jest.mock('react-native-worklets', () =>
  require('react-native-worklets/src/mock'),
);
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
);

function renderComposer(
  props: Partial<Parameters<typeof ChatComposer>[0]> = {},
) {
  const callbacks = {
    onChangeText: jest.fn(),
    onSubmit: jest.fn(),
    onStop: jest.fn(),
  };
  render(
    <ChatComposer
      value="Ranger Raptor"
      running={false}
      disabled={false}
      {...callbacks}
      {...props}
    />,
  );
  return callbacks;
}

describe('ChatComposer', () => {
  it('sends a non-empty draft', () => {
    const { onSubmit } = renderComposer();
    fireEvent.press(screen.getByLabelText('Send message'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not send a blank draft', () => {
    const { onSubmit } = renderComposer({ value: '   ' });
    fireEvent.press(screen.getByLabelText('Send message'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('stops a streaming reply', () => {
    const { onStop } = renderComposer({ running: true });
    fireEvent.press(screen.getByLabelText('Stop generating'));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('folds the options away while compact and keeps sending', () => {
    const { onSubmit } = renderComposer({
      compact: true,
      controls: <Text>Balanced</Text>,
    });
    expect(screen.queryByText('Balanced')).toBeNull();
    fireEvent.press(screen.getByLabelText('Send message'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('shows the options when expanded', () => {
    renderComposer({ controls: <Text>Balanced</Text> });
    expect(screen.getByText('Balanced')).toBeTruthy();
  });

  it('reports focus so the screen can unfold it', () => {
    const onFocusChange = jest.fn();
    renderComposer({ onFocusChange });
    fireEvent(screen.getByLabelText('Message'), 'focus');
    fireEvent(screen.getByLabelText('Message'), 'blur');
    expect(onFocusChange.mock.calls).toEqual([[true], [false]]);
  });
});
