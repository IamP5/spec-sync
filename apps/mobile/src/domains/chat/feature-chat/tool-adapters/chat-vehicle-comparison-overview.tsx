import {
  comparisonSchema,
  failureSchema,
} from '../../../vehicles/api/contracts';
import { VehicleComparisonOverview } from '../../../vehicles/api/features';
import { parseResult } from '../../util/parse-result';
import type { ToolAdapterProps } from './chat-tool-registry';
import { vehicleQuestionPrompt } from './vehicle-prompts';

/**
 * `compareVehicleConfigurations` and `getVehicleSpecifications`: the
 * comparison the tool returned, or its explicit failure. Questions from the
 * comparison are drafted into the composer for the user to edit.
 */
export function ChatVehicleComparisonOverview({
  call,
  actions,
}: ToolAdapterProps) {
  return (
    <VehicleComparisonOverview
      comparison={parseResult(call.result, comparisonSchema)}
      failure={parseResult(call.result, failureSchema)?.message}
      complete={call.status === 'complete'}
      onQuestion={(question) => actions.draft(vehicleQuestionPrompt(question))}
    />
  );
}
