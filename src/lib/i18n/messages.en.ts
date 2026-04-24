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

  'evidence.heading': 'Evidence packet',
  'evidence.subheading': 'Documents USCIS expects with your filing.',
  'evidence.status.met': 'Got it',
  'evidence.status.partial': 'Need more',
  'evidence.status.stale': 'Too old',
  'evidence.status.missing': 'Missing',
  'evidence.tier.required': 'Required',
  'evidence.tier.recommended': 'Recommended',
  'evidence.tier.conditional': 'If applicable',
  'evidence.citizenship': 'Proof of U.S. citizenship or LPR',
  'evidence.taxReturn': 'Most recent tax return',
  'evidence.payStubs': 'Pay stubs (last 6 months)',
  'evidence.photoId': 'Government photo ID',
  'evidence.domicile': 'Proof of U.S. domicile',
  'evidence.vet.mismatch':
    'You labeled this as {claimed} but it looks like a {detected}. I re-labeled it for you.',
  'evidence.vet.missingSchedules':
    'Your tax return may be missing supporting W-2s or schedules. USCIS requires every schedule you filed.',
  'evidence.vet.stale':
    'This document is older than USCIS prefers. Consider replacing with a more recent one.',

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

  'landing.hero.title': 'Fill U.S. immigration forms in minutes, not months.',
  'landing.hero.subtitle':
    "For families, students, and workers who don't want to pay $800 to a lawyer for paperwork they can do themselves. An accredited representative reviews everything before you file. Not a law firm.",
  'landing.hero.ctaHelp': "I'm not sure what I need",
  'landing.hero.ctaKnow': 'I know which form I need',
  'landing.hero.trust1': 'Works in 10 languages',
  'landing.hero.trust2': 'Always free while in beta',
  'landing.hero.trust3': "Your docs stay on your device until you submit",

  'landing.archetypes.heading': 'Which one sounds like you?',
  'landing.archetypes.a.title': 'I know which form.',
  'landing.archetypes.a.desc': "Maybe you're a green-card holder applying for citizenship, or a U.S. citizen petitioning for your spouse. You've been here before. Let's just file.",
  'landing.archetypes.a.cta': 'Start filling',
  'landing.archetypes.b.title': 'I think I qualify for something.',
  'landing.archetypes.b.desc': 'Friends or family told you about asylum, a family petition, DACA, or a green card. You want to know which actually applies to you.',
  'landing.archetypes.b.cta': 'Check eligibility',
  'landing.archetypes.c.title': "I'm scared and I don't know what to do.",
  'landing.archetypes.c.desc': "Your status is uncertain, or you're on parole, or you just got a court date. We'll walk through your situation and find what's available.",
  'landing.archetypes.c.cta': 'Get guidance',

  'landing.how.heading': 'How it works',
  'landing.how.step1.title': 'Upload your documents',
  'landing.how.step1.desc': 'Photo of your license, green card, passport, tax return, or pay stub. Drag + drop — phone photos are fine.',
  'landing.how.step2.title': 'Chat to fill the gaps',
  'landing.how.step2.desc': "We ask for what we couldn't read, in plain language, in your language. Skip anything you're not sure about.",
  'landing.how.step3.title': 'Accredited representative reviews',
  'landing.how.step3.desc': "A DOJ-accredited rep checks the filled form and flags anything that looks off. They sign off before you get the PDF.",
  'landing.how.step4.title': 'Download and file',
  'landing.how.step4.desc': 'You get a ready-to-print PDF + an evidence checklist. Mail it to USCIS or bring it to a filing appointment.',

  'landing.forms.heading': 'Forms we support',
  'landing.forms.subheading': 'Family-based immigration pipeline. More forms coming.',

  'landing.trust.heading': 'What we promise',
  'landing.trust.notLawFirm.title': 'Not a law firm',
  'landing.trust.notLawFirm.desc': 'Formcutter does not give legal advice. A DOJ-accredited representative reviews every case before submission.',
  'landing.trust.privacy.title': 'Your data is yours',
  'landing.trust.privacy.desc': "Your documents stay on your device until you submit for review. We never share with USCIS, ICE, or anyone else.",
  'landing.trust.humans.title': 'Built with immigrants',
  'landing.trust.humans.desc': "Designed in conversation with real paralegals and law clinic staff who file these forms every week.",

  'landing.faq.heading': 'Questions people ask',
  'landing.faq.q1.q': "Is this safe if I'm undocumented?",
  'landing.faq.q1.a': "Yes. Your documents stay on your device. We don't work with ICE or USCIS — we're independent. But if you're worried, use a trusted friend's device and delete browser history after.",
  'landing.faq.q2.q': 'How much does it cost?',
  'landing.faq.q2.a': "While we're in beta it's free. When we charge later, the fee will be disclosed upfront. USCIS filing fees are paid separately to USCIS.",
  'landing.faq.q3.q': "What if I make a mistake on the form?",
  'landing.faq.q3.a': "An accredited representative reviews everything before the PDF is released to you. You can also edit any field before they review. Nothing gets filed unless you physically mail it.",
  'landing.faq.q4.q': "Do you share data with USCIS or ICE?",
  'landing.faq.q4.a': "No. We don't report to any government agency. We don't even have a relationship with USCIS — we just help you fill out their forms.",
  'landing.faq.q5.q': "What languages do you support?",
  'landing.faq.q5.a': 'English, Spanish, Simplified Chinese, Vietnamese, Tagalog, Russian, Ukrainian, Arabic, Haitian Creole, and Portuguese. Pick your language in the top-right corner on any page.',
  'landing.faq.q6.q': "Can a lawyer or accredited rep use this?",
  'landing.faq.q6.a': "Yes — we built the reviewer console specifically for accredited reps and paralegals at nonprofit law clinics. Contact us if you run one.",

  'landing.footer.tagline': 'Not a law firm. Not legal advice.',
  'landing.footer.privacy': 'Privacy',
  'landing.footer.terms': 'Terms',
  'landing.footer.contact': 'Contact',

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
