/**
 * Notice templates — markdown defaults per notice type.
 * Admins customize the body in the Generate Notice modal; this is the
 * starting content. Tokens like {{investor.legalName}} are resolved at
 * generation time against the recipient + linked entity context.
 *
 * Adding a new template type:
 *  1. Add the key to `NoticeType` and a record to `NOTICE_TEMPLATES`.
 *  2. Add any new tokens you reference to `AVAILABLE_TOKENS`.
 *  3. Make sure the service builds the corresponding `ctx` shape.
 */

export type NoticeType =
  | 'CAPITAL_CALL'
  | 'DISTRIBUTION'
  | 'TRANSFER'
  | 'TOKEN_MINTED'
  | 'GENERAL';

export interface NoticeTemplate {
  readonly subject: string;
  readonly body: string;
}

export const NOTICE_TEMPLATES: Record<NoticeType, NoticeTemplate> = {
  CAPITAL_CALL: {
    subject:
      'Capital Call Notice — {{fund.name}} — Due {{capitalCall.dueDate}}',
    body: `# Capital Call Notice

**To:** {{investor.legalName}}
**Fund:** {{fund.name}}
**Date issued:** {{generatedAt}}

Pursuant to the Limited Partnership Agreement of {{fund.name}}, the General Partner hereby calls capital from each Limited Partner.

| Field | Value |
|---|---|
| Call number | {{capitalCall.callNumber}} |
| Amount due | {{capitalCall.amountDue}} |
| Ownership % | {{investor.ownershipPct}} |
| Due date | {{capitalCall.dueDate}} |

## Wire instructions

Please remit cleared funds to the fund's operating account by the due date above. Wire instructions are attached to this notice or available on request from the General Partner.

If funds are not received by the due date, the General Partner may issue a cure notice and apply the remedies described in the LPA.

Sincerely,
General Partner — {{fund.name}}`,
  },

  DISTRIBUTION: {
    subject:
      'Distribution Notice — {{fund.name}} — {{distribution.amount}}',
    body: `# Distribution Notice

**To:** {{investor.legalName}}
**Fund:** {{fund.name}}
**Date issued:** {{generatedAt}}

The General Partner has approved a distribution to Limited Partners of {{fund.name}}, calculated according to the waterfall provisions of the LPA.

| Field | Value |
|---|---|
| Distribution date | {{distribution.date}} |
| Your gross amount | {{distribution.amount}} |
| Ownership % | {{investor.ownershipPct}} |
| Source | {{distribution.source}} |

Funds will be wired to the bank account on file. The corresponding capital-account update is reflected in your investor portal.

Sincerely,
General Partner — {{fund.name}}`,
  },

  TRANSFER: {
    subject:
      'Transfer Notice — {{fund.name}} — {{investor.legalName}}',
    body: `# Limited Partnership Interest Transfer

**To:** {{investor.legalName}}
**Fund:** {{fund.name}}
**Date issued:** {{generatedAt}}

This notice confirms that a transfer of limited partnership interest in {{fund.name}} has been recorded on the fund's cap table and on-chain ledger.

| Field | Value |
|---|---|
| Document hash (SHA-256) | {{documentHash}} |
| On-chain anchor | {{anchorTxHash}} |

The transfer has been verified against the fund's compliance rules; both parties hold valid LP eligibility on the chain.

Sincerely,
General Partner — {{fund.name}}`,
  },

  TOKEN_MINTED: {
    subject: 'Tokens minted — {{fund.name}}',
    body: `# Tokens Minted

**To:** {{investor.legalName}}
**Fund:** {{fund.name}}
**Date issued:** {{generatedAt}}

Following settlement of your subscription, the corresponding security tokens representing your ownership interest in {{fund.name}} have been minted to your linked wallet.

| Field | Value |
|---|---|
| Ownership % | {{investor.ownershipPct}} |
| On-chain transaction | {{anchorTxHash}} |
| Document hash (SHA-256) | {{documentHash}} |

You can view your live cap table position and wallet balance in the investor portal.

Sincerely,
General Partner — {{fund.name}}`,
  },

  GENERAL: {
    subject: 'Notice from {{fund.name}}',
    body: `# General Notice

**To:** {{investor.legalName}}
**Fund:** {{fund.name}}
**Date issued:** {{generatedAt}}

{{custom.body}}

Sincerely,
General Partner — {{fund.name}}`,
  },
};

export const AVAILABLE_TOKENS: readonly string[] = [
  '{{investor.legalName}}',
  '{{investor.email}}',
  '{{investor.ownershipPct}}',
  '{{fund.name}}',
  '{{fund.code}}',
  '{{fund.lpaDate}}',
  '{{generatedAt}}',
  '{{capitalCall.callNumber}}',
  '{{capitalCall.amountDue}}',
  '{{capitalCall.dueDate}}',
  '{{distribution.amount}}',
  '{{distribution.date}}',
  '{{distribution.source}}',
  '{{documentHash}}',
  '{{anchorTxHash}}',
];

export type TokenContext = Record<string, string | number | null | undefined>;

/**
 * Replace `{{a.b}}` tokens with values from a flat context map. Unknown
 * tokens are left as-is so the admin sees what they need to fix.
 */
export function resolveTokens(
  template: string,
  ctx: Record<string, string | number | null | undefined>,
): string {
  return template.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (full, key) => {
    const v = ctx[key];
    if (v === undefined || v === null || v === '') return full;
    return String(v);
  });
}

export function getDefaultTemplate(
  type: string,
  ctx: Record<string, string | number | null | undefined>,
): NoticeTemplate {
  const tpl =
    (NOTICE_TEMPLATES as Record<string, NoticeTemplate | undefined>)[type] ??
    NOTICE_TEMPLATES.GENERAL;
  return {
    subject: resolveTokens(tpl.subject, ctx),
    body: resolveTokens(tpl.body, ctx),
  };
}
