/**
 * Canonical English source strings. All other language catalogs are generated
 * from this file by scripts/translate-messages.mjs and committed to
 * src/lib/i18n/catalogs/{code}.json.
 *
 * Keys use dotted namespaces (`header.brand`, `chat.inputPlaceholder`). Keep
 * keys stable; the translator reruns on key changes but existing translations
 * of unchanged values are cached.
 *
 * Keep text plain, literal, and at ~5th-grade reading level — these strings
 * appear in user-facing UI where users may have limited English proficiency.
 */
export const MESSAGES_EN = {
  'header.brand': 'formcutter',
  'header.subtitle': 'I-864 Affidavit of Support',
  'header.disclaimer': 'not a law firm · does not provide legal advice',
  'header.language.label': 'Language',

  'status.drafting': 'Drafting',
  'status.pendingReview': 'Pending review',
  'status.approved': 'Approved',
  'status.released': 'Released',

  'upload.heading': 'Upload documents',
  'upload.docType.label': 'What is this document?',
  'upload.docType.license': "Driver's license",
  'upload.docType.passport': 'Passport',
  'upload.docType.greenCard': 'Green card',
  'upload.docType.taxReturn': 'Tax return (1040)',
  'upload.docType.taxTranscript': 'IRS tax transcript',
  'upload.docType.paystub': 'Pay stub',
  'upload.docType.other': 'Other',
  'upload.dropzone.idle': 'Drag and drop, or click to upload',
  'upload.dropzone.dragging': 'Drop to upload',
  'upload.dropzone.hint': 'png, jpg, or pdf — up to 10MB',
  'upload.bubble.extracting': 'extracting…',
  'upload.bubble.failed': 'failed',

  'state.heading': 'Form state',
  'state.filledCount': '{count} filled',
  'state.showSensitive': 'show sensitive',
  'state.hideSensitive': 'hide sensitive',

  'action.submit': 'Submit for reviewer',
  'action.submitting': 'Submitting…',
  'action.download': 'Download filled PDF',
  'action.downloadLocked': 'Locked until reviewer approves',
  'action.newCase': 'Start a new case',

  'banner.pendingReview.title': 'Waiting on reviewer',
  'banner.pendingReview.body':
    'An accredited representative is reviewing your case. Your PDF will unlock once they approve.',
  'banner.approved.title': 'Approved ✓',
  'banner.approved.body': 'Your reviewer signed off. Download the filled I-864 below.',

  'chat.greeting':
    "Hey — I'll help you fill out your I-864. Upload a photo of your license, green card, passport, or tax transcript. I'll extract what I can and then walk through anything missing.",
  'chat.inputPlaceholder': 'type your answer…',
  'chat.thinking': 'thinking…',
  'chat.locked': 'Case locked — start a new case to edit',
  'chat.send': 'Send',
  'chat.simplify': 'Simplify',
  'chat.mic.start': 'Hold to speak',
  'chat.mic.listening': 'Listening…',

  'chat.formcutterAi': 'Formcutter AI',

  'chat.footer.disclaimer':
    'Formcutter is not a law firm and does not provide legal advice. Legal-strategy questions are flagged for an accredited-representative reviewer.',

  'date.today': 'Today',
  'date.yesterday': 'Yesterday',

  'evidence.heading': 'Required evidence',
  'evidence.collected': 'Collected',
  'evidence.missing': 'Missing',
  'evidence.stale': 'Too old',
  'evidence.mismatch': 'Wrong type',

  'wizard.heading': "Let's figure out what you need",
  'wizard.subheading':
    "A few quick questions to match you with the right immigration relief and forms. This doesn't replace a lawyer — it narrows down what to ask them about.",
  'wizard.bypass': 'I already know which form I need',
  'wizard.continue': 'Continue',
  'wizard.back': 'Back',
  'wizard.finish': 'See my options',
  'wizard.q.status': 'What is your current immigration status?',
  'wizard.q.entry': 'How did you enter the United States?',
  'wizard.q.entryDate': 'Roughly when did you enter or last re-enter?',
  'wizard.q.family': 'Do you have any US citizen or green card holder family members?',
  'wizard.q.removal': 'Are you currently in removal / deportation proceedings?',
  'wizard.q.goal': 'What are you hoping to accomplish?',

  'rep.header.badge': 'Reviewer console',
  'rep.header.signedInAs': 'signed in as: {name} · accredited rep (demo)',
  'rep.header.backToImmigrant': 'Back to immigrant view',
  'rep.cases.heading': 'Case queue',
  'rep.cases.subheading': 'Submitted cases awaiting your review.',
  'rep.cases.empty': 'No cases yet. Cases appear here once a sponsor submits for review.',
  'rep.case.approve': 'Approve',
  'rep.case.dismiss': 'Dismiss',
  'rep.case.release': 'Release PDF to sponsor',
  'rep.case.whyFlagged': 'Why this was flagged',
} as const

export type MessageKey = keyof typeof MESSAGES_EN
export const ALL_KEYS = Object.keys(MESSAGES_EN) as MessageKey[]
