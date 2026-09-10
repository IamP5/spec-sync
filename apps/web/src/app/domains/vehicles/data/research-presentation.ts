import type { IngestionClaim } from './ingestion-contracts';
import { researchIsActive, type ResearchSnapshot } from './research-contracts';

export interface ResearchComparisonRow {
  code: string;
  label: string;
  cells: IngestionClaim[][];
}

/** Keep competing observations and conditions; never pick a draft as an accepted value. */
export function researchComparisonRows(
  research: ResearchSnapshot,
): ResearchComparisonRow[] {
  const rows = new Map<string, ResearchComparisonRow>();
  research.configurations.forEach((configuration, index) => {
    for (const claim of configuration.claims) {
      let row = rows.get(claim.attributeCode);
      if (!row) {
        row = {
          code: claim.attributeCode,
          label: claim.label,
          cells: research.configurations.map(() => []),
        };
        rows.set(claim.attributeCode, row);
      }
      row.cells[index].push(claim);
    }
  });
  return [...rows.values()];
}

export function researchClaimValue(claim: IngestionClaim): string {
  if (claim.listValue?.length) return claim.listValue.join(', ');
  if (
    !claim.issues.length &&
    Array.isArray(claim.value) &&
    claim.value.length &&
    claim.value.every((value) => typeof value === 'string' && value.trim())
  )
    return claim.value.join(', ');
  return claim.rawValue;
}

export function researchStatus(research: ResearchSnapshot): string {
  if (research.requestStatus === 'CANCELLED') return 'Not following';
  if (researchIsActive(research)) {
    const retrying =
      research.attempts > 1 ||
      (research.status === 'QUEUED' && research.attempts > 0);
    if (research.status === 'QUEUED')
      return retrying
        ? `Retry queued after attempt ${research.attempts}`
        : 'Queued';
    const progress =
      research.stage === 'capture-source'
        ? 'Source captured'
        : research.stage === 'identify-configurations'
          ? 'Configurations identified'
          : /^extract-(?:[a-f0-9]{20}-)?configuration-\d+$/.test(research.stage)
            ? 'Extracting specifications'
            : 'Researching sources';
    return retrying
      ? `Retrying research · attempt ${research.attempts} · ${progress}`
      : progress;
  }
  return {
    REVIEW: 'Ready for review',
    PUBLISHED: 'Catalog update published',
    FAILED: 'Research failed',
    REJECTED: 'Research rejected',
    QUEUED: 'Queued',
    PROCESSING: 'Researching sources',
  }[research.status];
}

/** Checkpoints describe completed work; terminal failure never implies completion. */
export function researchStage(research: ResearchSnapshot): {
  index: number;
  label: string;
  note: string;
} {
  const stage = research.stage;
  const index = ['REVIEW', 'PUBLISHED'].includes(research.status)
    ? 3
    : stage === 'identify-configurations' ||
        /^extract-(?:[a-f0-9]{20}-)?configuration-\d+$/.test(stage) ||
        research.configurations.length > 0
      ? 2
      : stage === 'capture-source' || research.source
        ? 1
        : 0;
  if (research.requestStatus === 'CANCELLED')
    return {
      index,
      label: 'Você deixou de acompanhar',
      note: 'A pesquisa compartilhada pode continuar para outras pessoas.',
    };
  if (research.status === 'FAILED' || research.status === 'REJECTED')
    return {
      index,
      label: 'A pesquisa precisa de atenção',
      note: 'Os resultados já encontrados continuam disponíveis para consulta.',
    };
  if (research.status === 'PUBLISHED')
    return {
      index,
      label: 'Atualização publicada no catálogo',
      note: 'As evidências podem incluir informações além da seleção publicada.',
    };
  if (research.status === 'REVIEW')
    return {
      index,
      label: 'Pronta para revisar',
      note: 'Confira as evidências e as informações que ainda precisam de confirmação.',
    };
  if (research.status === 'QUEUED')
    return {
      index,
      label: research.attempts
        ? 'Aguardando nova tentativa'
        : 'Pesquisa na fila',
      note: research.attempts
        ? 'A pesquisa retoma automaticamente e reutiliza as etapas concluídas.'
        : 'Você pode continuar no chat. Os resultados aparecem conforme a pesquisa avança.',
    };
  return {
    index,
    label: ['Buscando fontes', 'Lendo o documento', 'Conferindo as versões'][
      index
    ],
    note: 'Atualização automática. Você pode sair e voltar pelo histórico de pesquisas.',
  };
}

export interface ResearchEvidenceFocus {
  configuration: string;
  attribute: string;
}
