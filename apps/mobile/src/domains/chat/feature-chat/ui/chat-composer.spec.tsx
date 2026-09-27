import { fireEvent, render, screen } from '@testing-library/react-native';

import { ChatComposer } from './chat-composer';

describe('ChatComposer', () => {
  it('sends a non-empty draft', () => {
    const onSubmit = jest.fn();
    render(
      <ChatComposer
        value="Ranger Raptor"
        onChangeText={jest.fn()}
        onSubmit={onSubmit}
        disabled={false}
      />,
    );
    fireEvent.press(screen.getByLabelText('Send message'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not send a blank draft', () => {
    const onSubmit = jest.fn();
    render(
      <ChatComposer
        value="   "
        onChangeText={jest.fn()}
        onSubmit={onSubmit}
        disabled={false}
      />,
    );
    fireEvent.press(screen.getByLabelText('Send message'));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
