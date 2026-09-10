import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ChatVehicleIngestionEdit } from './chat-vehicle-ingestion-edit';

it('keeps historical standalone imports as links without mounting another review or key prompt', async () => {
  await TestBed.configureTestingModule({
    imports: [ChatVehicleIngestionEdit],
    providers: [provideRouter([])],
  }).compileComponents();
  const fixture = TestBed.createComponent(ChatVehicleIngestionEdit);
  const id = '00000000-0000-4000-8000-000000000001';
  fixture.componentRef.setInput('toolCall', {
    status: 'complete',
    args: {},
    result: {
      status: 'STARTED',
      runId: id,
      runStatus: 'QUEUED',
      message: 'Import started',
    },
  });
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  expect(element.querySelector('a')?.getAttribute('href')).toBe(
    `/ingestion/${id}`,
  );
  expect(element.querySelector('app-vehicle-ingestion-run-detail')).toBeNull();
  expect(element.querySelector('input[type="password"]')).toBeNull();
});
