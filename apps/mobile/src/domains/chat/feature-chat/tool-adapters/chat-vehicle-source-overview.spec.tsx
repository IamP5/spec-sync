import { fireEvent, render, screen } from '@testing-library/react-native';

import type { ToolCallView } from '../../data/tool-call';
import { ChatVehicleSourceOverview } from './chat-vehicle-source-overview';

const preview = {
  status: 'OK',
  source: {
    url: 'https://www.ford.com.br/ranger.pdf',
    title: 'ranger.pdf',
    mimeType: 'application/pdf',
    pageCount: 6,
  },
  configurations: [
    {
      name: 'XLT 2.0',
      powertrain: '2.0 Diesel AT 4x4',
      column: 'XLT',
      locator: 'Page 3, column 2',
      excerpt: 'XLT',
    },
    {
      name: 'LIMITED 3.0 V6',
      powertrain: '3.0 V6 Diesel AT 4x4',
      column: 'LIMITED',
      locator: 'Page 3, column 3',
      excerpt: 'LIMITED',
    },
  ],
  legend: [{ symbol: 'S', meaning: 'série' }],
  modelYearNote: 'Model year 2026 stated on page 1',
  notes: [],
  message: 'The source presents 2 configuration(s).',
};

function call(overrides: Partial<ToolCallView> = {}): ToolCallView {
  return {
    id: 'call-1',
    name: 'previewVehicleSource',
    args: {
      sourceUrl: preview.source.url,
      brand: 'Ford',
      model: 'Ranger',
      modelYear: '2026',
    },
    status: 'complete',
    result: JSON.stringify(preview),
    ...overrides,
  };
}

function setup(view: ToolCallView = call()) {
  const actions = { draft: jest.fn(), send: jest.fn(), canSend: true };
  render(<ChatVehicleSourceOverview call={view} actions={actions} />);
  return actions;
}

describe('Chat source preview card', () => {
  it('lists the configurations and asks the agent to import the ticked ones', () => {
    const actions = setup();
    expect(screen.getByText('2 found')).toBeTruthy();
    expect(screen.getByText(/S = série/)).toBeTruthy();
    const importButton = screen.getByLabelText('Import 0 selected');
    fireEvent.press(importButton);
    expect(actions.send).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('checkbox', { name: 'LIMITED 3.0 V6' }));
    fireEvent.press(screen.getByLabelText('Import 1 selected'));
    expect(actions.send).toHaveBeenCalledTimes(1);
    const prompt = actions.send.mock.calls[0][0] as string;
    expect(prompt).toContain('LIMITED 3.0 V6');
    expect(prompt).not.toContain('XLT 2.0');
    expect(prompt).toContain('Ford Ranger 2026');
    expect(prompt).toContain(preview.source.url);
    expect(prompt).toContain('startVehicleIngestion');
  });

  it('imports everything without naming configurations', () => {
    const actions = setup();
    fireEvent.press(screen.getByLabelText('Import all (2)'));
    expect(actions.send.mock.calls[0][0]).toContain(
      'every configuration the source presents',
    );
  });

  it('shows the tool failure, the running state and an invalid result explicitly', () => {
    setup(
      call({
        result: JSON.stringify({ status: 'ERROR', message: 'Not a PDF' }),
      }),
    );
    expect(screen.getByText('Source could not be read')).toBeTruthy();
    expect(screen.getByText('Not a PDF')).toBeTruthy();
    screen.unmount();
    setup(call({ status: 'executing', result: undefined }));
    expect(
      screen.getByText('Reading the source and listing its configurations…'),
    ).toBeTruthy();
    screen.unmount();
    setup(call({ result: '{"status":"OK"}' }));
    expect(screen.getByText('No valid preview returned.')).toBeTruthy();
  });
});
