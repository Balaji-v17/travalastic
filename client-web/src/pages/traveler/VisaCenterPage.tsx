import { useState, useRef, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import {
  visaRequirements,
  type VisaRequirement,
  type VisaApplication,
  type VisaDocument,
} from '../../data/mockData';

type ViewMode = 'home' | 'apply' | 'status';
type ApplyStep = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  'document-check': 'Document Check',
  'appointment-scheduled': 'Appointment Scheduled',
  'under-review': 'Under Review',
  'decision-pending': 'Decision Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  'collection-ready': 'Ready for Collection',
  collected: 'Collected',
};

const STATUS_COLORS: Record<string, string> = {
  approved: 'bg-emerald-100 text-emerald-700',
  'under-review': 'bg-blue-100 text-blue-700',
  'document-check': 'bg-blue-100 text-blue-700',
  submitted: 'bg-amber-100 text-amber-700',
  'appointment-scheduled': 'bg-violet-100 text-violet-700',
  'decision-pending': 'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-700',
  'collection-ready': 'bg-emerald-100 text-emerald-700',
  collected: 'bg-slate-100 text-slate-700',
  draft: 'bg-slate-100 text-slate-600',
};

const VISA_TYPE_BADGE: Record<string, string> = {
  required: 'bg-red-100 text-red-700',
  'on-arrival': 'bg-amber-100 text-amber-700',
  'e-visa': 'bg-blue-100 text-blue-700',
  'visa-free': 'bg-emerald-100 text-emerald-700',
};

const VISA_TYPE_LABEL: Record<string, string> = {
  required: 'Visa Required',
  'on-arrival': 'Visa on Arrival',
  'e-visa': 'e-Visa',
  'visa-free': 'Visa Free',
};

const STEP_LABELS = [
  'Requirements',
  'Visa Type',
  'Traveler Info',
  'Documents',
  'Cover Letter',
  'Review',
  'Confirmed',
];

const TIMELINE_STAGES = [
  { key: 'submitted', label: 'Application Submitted' },
  { key: 'document-check', label: 'Document Verification' },
  { key: 'appointment-scheduled', label: 'Appointment Scheduled' },
  { key: 'under-review', label: 'Embassy Review' },
  { key: 'decision-pending', label: 'Decision' },
  { key: 'approved', label: 'Collection' },
];

function generateRefNumber(country: string): string {
  const code = country.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase();
  const num = Math.floor(Math.random() * 9000 + 1000);
  return `VISA-${code}-${num}-T`;
}

function getStageIndex(status: string): number {
  const order = ['submitted', 'document-check', 'appointment-scheduled', 'under-review', 'decision-pending', 'approved'];
  return order.indexOf(status);
}

// ─── AI Chat Modal ────────────────────────────────────────────────────────────

interface AIChatMessage {
  role: 'user' | 'ai';
  text: string;
}

const AI_RESPONSES: Record<string, string> = {
  status: "Your application is currently under document verification. The embassy has received your application and is reviewing the submitted documents.",
  decision: "Based on typical processing times for Japan tourist visas, decisions usually come within 10 business days of submission. You should hear back soon.",
  documents: "You submitted 7 documents including your passport copy, photograph, flight confirmation, hotel booking, bank statements (3 months), cover letter, and income tax returns.",
  next: "Next, the embassy will schedule an appointment if needed, then conduct a formal review. You will be notified by email at each stage.",
  appointment: "Your appointment details will be updated here once the embassy contacts you. Keep an eye on your registered email.",
};

function getAIResponse(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes('status') || lower.includes('progress')) return AI_RESPONSES.status;
  if (lower.includes('decision') || lower.includes('when') || lower.includes('long')) return AI_RESPONSES.decision;
  if (lower.includes('document')) return AI_RESPONSES.documents;
  if (lower.includes('next') || lower.includes('what happen')) return AI_RESPONSES.next;
  if (lower.includes('appointment')) return AI_RESPONSES.appointment;
  return "I can help you with your visa application status, document queries, appointment details, and expected timelines. What would you like to know?";
}

function AIChatModal({ app, onClose }: { app: VisaApplication; onClose: () => void }) {
  const [messages, setMessages] = useState<AIChatMessage[]>([
    { role: 'ai', text: `I'm tracking your ${app.country} ${app.visaTypeName} application (${app.referenceNumber ?? 'DRAFT'}). Ask me anything about your visa status, documents, or next steps.` },
  ]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function send() {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setTimeout(() => {
      setMessages((prev) => [...prev, { role: 'ai', text: getAIResponse(userMsg) }]);
    }, 700);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col" style={{ maxHeight: '80vh' }}>
        <div className="flex items-center gap-3 p-4 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center text-white text-sm font-bold">AI</div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">Visa AI Assistant</p>
            <p className="text-xs text-slate-500">{app.country} · {app.referenceNumber ?? 'Draft'}</p>
          </div>
          <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${m.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-slate-100 text-slate-800 rounded-bl-sm'}`}>
                {m.text}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div className="p-4 border-t border-slate-100 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Ask about your visa..."
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button onClick={send} className="bg-blue-600 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors">Send</button>
        </div>
      </div>
    </div>
  );
}

// ─── Status View ──────────────────────────────────────────────────────────────

function StatusView({ app, onBack, onAskAI }: { app: VisaApplication; onBack: () => void; onAskAI: () => void }) {
  const currentIdx = getStageIndex(app.status);

  return (
    <div className="animate-fade-in max-w-2xl mx-auto px-4 py-8 space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm transition-colors">
        <span>←</span> Back to Visa Center
      </button>

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-white p-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="text-slate-400 text-sm mb-1">Application Status</p>
            <h2 className="font-display text-2xl">{app.country} Visa</h2>
            <p className="text-slate-300 text-sm mt-1">{app.visaTypeName}</p>
          </div>
          <div className="text-right">
            <p className="text-slate-400 text-xs mb-1">Reference</p>
            <p className="font-mono text-sm font-semibold">{app.referenceNumber ?? 'N/A'}</p>
          </div>
        </div>
        <div className="mt-4">
          <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[app.status] ?? 'bg-slate-100 text-slate-600'}`}>
            {STATUS_LABELS[app.status] ?? app.status}
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-2xl bg-white border border-slate-100 p-6">
        <h3 className="font-display text-lg text-slate-900 mb-5">Application Timeline</h3>
        <div className="relative space-y-0">
          {TIMELINE_STAGES.map((stage, idx) => {
            const isCompleted = idx < currentIdx;
            const isCurrent = idx === currentIdx;
            const isFuture = idx > currentIdx;
            return (
              <div key={stage.key} className="flex gap-4 pb-6 last:pb-0">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 relative z-10 ${isCompleted ? 'bg-emerald-500' : isCurrent ? 'bg-blue-500' : 'bg-slate-200'}`}>
                    {isCompleted && <span className="text-white text-xs">✓</span>}
                    {isCurrent && (
                      <span className="w-3 h-3 rounded-full bg-white animate-pulse block" />
                    )}
                  </div>
                  {idx < TIMELINE_STAGES.length - 1 && (
                    <div className={`w-0.5 flex-1 mt-1 ${isCompleted ? 'bg-emerald-300' : 'bg-slate-200'}`} style={{ minHeight: '1.5rem' }} />
                  )}
                </div>
                <div className="pt-1 pb-1">
                  <p className={`text-sm font-semibold ${isCompleted ? 'text-emerald-700' : isCurrent ? 'text-blue-700' : 'text-slate-400'}`}>
                    {stage.label}
                  </p>
                  <p className={`text-xs mt-0.5 ${isCurrent ? 'text-blue-500 font-medium' : 'text-slate-400'}`}>
                    {isCompleted
                      ? app.submittedAt
                        ? new Date(app.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                        : 'Completed'
                      : isCurrent
                      ? 'In Progress'
                      : 'Pending'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Documents submitted */}
      <div className="rounded-2xl bg-white border border-slate-100 p-6">
        <h3 className="font-display text-lg text-slate-900 mb-4">Documents Submitted</h3>
        <div className="space-y-2">
          {app.documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${doc.status === 'verified' || doc.status === 'auto-detected' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {doc.status === 'verified' || doc.status === 'auto-detected' ? '✓' : '!'}
              </span>
              <span className="text-sm text-slate-700">{doc.name}</span>
              {doc.source && <span className="ml-auto text-xs text-slate-400 capitalize">{doc.source}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Info strip */}
      <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 flex flex-wrap gap-6 text-sm">
        <div>
          <p className="text-slate-500 text-xs mb-0.5">Fee Paid</p>
          <p className="font-semibold text-slate-800">₹{app.fee.toLocaleString('en-IN')}</p>
        </div>
        <div>
          <p className="text-slate-500 text-xs mb-0.5">Processing</p>
          <p className="font-semibold text-slate-800">{app.processingDays} business days</p>
        </div>
        {app.submittedAt && (
          <div>
            <p className="text-slate-500 text-xs mb-0.5">Submitted</p>
            <p className="font-semibold text-slate-800">{new Date(app.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
          Contact Embassy
        </button>
        <button
          onClick={onAskAI}
          className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white py-3 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Ask Visa AI
        </button>
      </div>
    </div>
  );
}

// ─── Apply Wizard ─────────────────────────────────────────────────────────────

interface WizardState {
  step: ApplyStep;
  selectedReq: VisaRequirement | null;
  selectedTypeId: string;
  draftApp: Partial<VisaApplication>;
  coverLetter: string;
}

function buildDocuments(req: VisaRequirement, travelerPassport: string, hasJourney: boolean): VisaDocument[] {
  return req.requiredDocuments.map((docName, idx) => {
    let status: VisaDocument['status'] = 'pending';
    let source: VisaDocument['source'] | undefined;

    const lower = docName.toLowerCase();
    if (lower.includes('passport')) {
      if (travelerPassport) { status = 'auto-detected'; source = 'profile'; }
    } else if (lower.includes('flight')) {
      if (hasJourney) { status = 'auto-detected'; source = 'journey'; }
    } else if (lower.includes('hotel') || lower.includes('accommodation')) {
      if (hasJourney) { status = 'auto-detected'; source = 'journey'; }
    }

    return { id: `doc-${idx}`, type: lower.replace(/\s+/g, '-'), name: docName, status, source };
  });
}

function buildCoverLetter(req: VisaRequirement, travelerName: string, journeyDates: string): string {
  return `To the Visa Section,
Embassy of ${req.country}

Subject: Application for ${req.visaType === 'e-visa' ? 'e-Visa' : 'Tourist Visa'} — ${req.country}

Dear Sir/Madam,

I, ${travelerName}, an Indian national holding passport number P1234567, respectfully request a tourist visa to visit ${req.country}.

Purpose of Visit: Tourism and leisure travel.
Intended Stay: ${req.maxStay ?? '30 days'}
Travel Dates: ${journeyDates || 'To be confirmed'}

I confirm that I have sufficient funds to support my trip and intend to return to India upon completion of my visit.

Enclosed are all required documents for your review:
${req.requiredDocuments.map((d, i) => `${i + 1}. ${d}`).join('\n')}

I sincerely appreciate your consideration and look forward to a positive response.

Yours faithfully,
${travelerName}
Mumbai, Maharashtra, India`;
}

function ApplyWizard({
  initialReq,
  onFinish,
  onCancel,
}: {
  initialReq: VisaRequirement | null;
  onFinish: (app: VisaApplication, refNum: string) => void;
  onCancel: () => void;
}) {
  const { traveler, journeys, selectedJourneyId, addVisaApplication, updateVisaApplication } = useApp();

  const activeJourney = journeys.find((j) => j.id === selectedJourneyId) ?? journeys.find((j) => ['planning', 'booked', 'pre-travel', 'in-travel'].includes(j.status)) ?? null;
  const hasJourney = !!activeJourney;

  const [wizard, setWizard] = useState<WizardState>({
    step: 0,
    selectedReq: initialReq,
    selectedTypeId: '',
    draftApp: {},
    coverLetter: '',
  });

  const req = wizard.selectedReq;
  const selectedType = req?.types.find((t) => t.id === wizard.selectedTypeId) ?? null;
  const docs = req ? buildDocuments(req, traveler.passportNumber ?? '', hasJourney) : [];

  function next() { setWizard((w) => ({ ...w, step: (w.step + 1) as ApplyStep })); }

  function goStep(s: ApplyStep) { setWizard((w) => ({ ...w, step: s })); }

  function selectType(id: string) {
    setWizard((w) => ({ ...w, selectedTypeId: id }));
    setTimeout(() => setWizard((w) => ({ ...w, step: 2 })), 200);
  }

  function initCoverLetter() {
    if (!req || wizard.coverLetter) return;
    const dates = activeJourney?.startDate ? `${activeJourney.startDate} – ${activeJourney.endDate ?? ''}` : '';
    const letter = buildCoverLetter(req, traveler.name ?? 'Arjun Mehta', dates);
    setWizard((w) => ({ ...w, coverLetter: letter }));
  }

  function handleSubmit() {
    if (!req || !selectedType) return;
    const refNum = generateRefNumber(req.country);
    const id = `visa-${Date.now()}`;
    const app: VisaApplication = {
      id,
      destinationId: req.destinationId,
      country: req.country,
      journeyId: activeJourney?.id,
      visaTypeId: selectedType.id,
      visaTypeName: selectedType.name,
      status: 'submitted',
      referenceNumber: refNum,
      submittedAt: new Date().toISOString(),
      documents: docs,
      fee: selectedType.fee,
      processingDays: selectedType.processingDays,
    };
    addVisaApplication(app);
    setTimeout(() => {
      updateVisaApplication(id, { status: 'document-check' });
    }, 500);
    goStep(6);
    onFinish(app, refNum);
  }

  if (!req) return null;

  const readyDocs = docs.filter((d) => d.status === 'auto-detected' || d.status === 'verified').length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {STEP_LABELS.map((label, i) => (
            <div key={i} className={`flex-1 text-center text-xs font-medium ${i === wizard.step ? 'text-blue-600' : i < wizard.step ? 'text-emerald-600' : 'text-slate-400'}`}>
              <div className={`h-1.5 rounded-full mb-1.5 mx-0.5 ${i < wizard.step ? 'bg-emerald-500' : i === wizard.step ? 'bg-blue-500' : 'bg-slate-200'}`} />
              <span className="hidden sm:inline">{label}</span>
            </div>
          ))}
        </div>
        <p className="text-center text-slate-500 text-xs sm:hidden">Step {wizard.step + 1} of {STEP_LABELS.length}: {STEP_LABELS[wizard.step]}</p>
      </div>

      {/* ── Step 0: Requirements ── */}
      {wizard.step === 0 && (
        <div className="space-y-5 animate-slide-up">
          <div>
            <h2 className="font-display text-2xl text-slate-900">Visa Requirements</h2>
            <p className="text-slate-500 text-sm mt-1">Based on your Indian passport for travel to {req.country}</p>
          </div>

          <div className="rounded-2xl bg-white border border-slate-100 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-4xl">{req.flag}</span>
              <div>
                <h3 className="font-semibold text-slate-900 text-lg">{req.country}</h3>
                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${VISA_TYPE_BADGE[req.visaType]}`}>
                  {VISA_TYPE_LABEL[req.visaType]}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="text-center p-3 bg-slate-50 rounded-xl">
                <p className="text-slate-500 text-xs mb-1">Fee</p>
                <p className="font-bold text-slate-900">{req.fee ? `₹${req.fee.toLocaleString('en-IN')}` : 'Free'}</p>
              </div>
              <div className="text-center p-3 bg-slate-50 rounded-xl">
                <p className="text-slate-500 text-xs mb-1">Processing</p>
                <p className="font-bold text-slate-900">{req.processingDays ? `${req.processingDays} days` : 'On arrival'}</p>
              </div>
              <div className="text-center p-3 bg-slate-50 rounded-xl">
                <p className="text-slate-500 text-xs mb-1">Max Stay</p>
                <p className="font-bold text-slate-900">{req.maxStay ?? '30 days'}</p>
              </div>
            </div>
            {req.notes && (
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800 leading-relaxed">
                {req.notes}
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Nationality</p>
              <p className="text-sm text-slate-700">🇮🇳 Indian — Passport: {traveler.passportNumber ?? 'P1234567'}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={onCancel} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
            <button onClick={next} className="flex-1 rounded-xl bg-blue-600 text-white py-3 text-sm font-semibold hover:bg-blue-700 transition-colors">
              Continue to Visa Type →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 1: Visa Type ── */}
      {wizard.step === 1 && (
        <div className="space-y-5 animate-slide-up">
          <div>
            <h2 className="font-display text-2xl text-slate-900">Select Visa Type</h2>
            <p className="text-slate-500 text-sm mt-1">Choose the visa category that matches your travel purpose</p>
          </div>
          <div className="space-y-3">
            {req.types.map((t) => (
              <button
                key={t.id}
                onClick={() => selectType(t.id)}
                className={`w-full text-left rounded-2xl border-2 p-5 transition-all hover:border-blue-400 hover:shadow-sm ${wizard.selectedTypeId === t.id ? 'border-blue-500 bg-blue-50' : 'border-slate-100 bg-white'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">{t.name}</p>
                    <p className="text-slate-500 text-sm mt-0.5">{t.description}</p>
                    <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-600">
                      <span className="flex items-center gap-1"><span className="text-slate-400">Stay:</span> {t.maxStay}</span>
                      <span className="flex items-center gap-1"><span className="text-slate-400">Valid:</span> {t.validity}</span>
                      <span className="flex items-center gap-1"><span className="text-slate-400">Processing:</span> {t.processingDays} days</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-slate-900 text-lg">₹{t.fee.toLocaleString('en-IN')}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <button onClick={() => goStep(0)} className="w-full rounded-xl border border-slate-200 py-3 text-sm text-slate-500 hover:bg-slate-50 transition-colors">← Back</button>
        </div>
      )}

      {/* ── Step 2: Traveler Info ── */}
      {wizard.step === 2 && (
        <div className="space-y-5 animate-slide-up">
          <div>
            <h2 className="font-display text-2xl text-slate-900">Traveler Information</h2>
            <p className="text-slate-500 text-sm mt-1">Auto-filled from your Travel Identity. Review and confirm.</p>
          </div>
          <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800 flex items-start gap-2">
            <span>ℹ️</span>
            <span>This information is pulled from your profile. You can edit any field if needed.</span>
          </div>
          <div className="rounded-2xl bg-white border border-slate-100 p-6 space-y-4">
            {[
              { label: 'Full Name', value: traveler.name ?? 'Arjun Mehta' },
              { label: 'Passport Number', value: traveler.passportNumber ?? 'P1234567' },
              { label: 'Nationality', value: traveler.nationality ?? 'Indian' },
              { label: 'Date of Birth', value: '15 Aug 1990' },
              { label: 'Home Address', value: 'Mumbai, Maharashtra, India' },
            ].map((field) => (
              <div key={field.label}>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">{field.label}</label>
                <input
                  type="text"
                  defaultValue={field.value}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={() => goStep(1)} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm text-slate-600 hover:bg-slate-50 transition-colors">← Back</button>
            <button onClick={next} className="flex-1 rounded-xl bg-blue-600 text-white py-3 text-sm font-semibold hover:bg-blue-700 transition-colors">Confirm & Continue →</button>
          </div>
        </div>
      )}

      {/* ── Step 3: Documents ── */}
      {wizard.step === 3 && (
        <div className="space-y-5 animate-slide-up">
          <div>
            <h2 className="font-display text-2xl text-slate-900">Document Checklist</h2>
            <p className="text-slate-500 text-sm mt-1">{readyDocs} of {docs.length} documents ready</p>
          </div>
          <div className="rounded-2xl bg-white border border-slate-100 divide-y divide-slate-50">
            {docs.map((doc) => (
              <div key={doc.id} className="flex items-center gap-4 p-4">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold ${doc.status === 'auto-detected' ? 'bg-blue-100 text-blue-600' : doc.status === 'verified' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                  {doc.status === 'auto-detected' ? '●' : doc.status === 'verified' ? '✓' : '!'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{doc.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5 capitalize">
                    {doc.status === 'auto-detected' ? `Auto-detected from ${doc.source}` : doc.status === 'verified' ? 'Verified' : 'Upload required'}
                  </p>
                </div>
                {doc.status === 'pending' && (
                  <button className="text-xs font-medium text-blue-600 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors flex-shrink-0">
                    Upload
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="rounded-2xl bg-violet-50 border border-violet-100 p-4 flex items-start gap-3">
            <span className="text-violet-600 text-lg">✍️</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-violet-900">Journey AI can help draft your cover letter</p>
              <p className="text-xs text-violet-600 mt-0.5">Generate a professional cover letter tailored to your trip.</p>
            </div>
            <button onClick={() => { initCoverLetter(); goStep(4); }} className="text-xs font-semibold text-violet-700 border border-violet-300 rounded-lg px-3 py-1.5 hover:bg-violet-100 transition-colors flex-shrink-0">
              Draft Letter
            </button>
          </div>
          <div className="flex gap-3">
            <button onClick={() => goStep(2)} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm text-slate-600 hover:bg-slate-50 transition-colors">← Back</button>
            <button onClick={next} className="flex-1 rounded-xl bg-blue-600 text-white py-3 text-sm font-semibold hover:bg-blue-700 transition-colors">Continue to Review →</button>
          </div>
        </div>
      )}

      {/* ── Step 4: Cover Letter ── */}
      {wizard.step === 4 && (
        <div className="space-y-5 animate-slide-up">
          {!wizard.coverLetter && void initCoverLetter()}
          <div>
            <h2 className="font-display text-2xl text-slate-900">Cover Letter</h2>
            <p className="text-slate-500 text-sm mt-1">Review and personalise your auto-generated cover letter.</p>
          </div>
          <div className="rounded-2xl bg-white border border-slate-100 p-4">
            <textarea
              value={wizard.coverLetter}
              onChange={(e) => setWizard((w) => ({ ...w, coverLetter: e.target.value }))}
              rows={16}
              className="w-full text-sm text-slate-700 leading-relaxed focus:outline-none resize-none font-mono"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => { initCoverLetter(); }}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              ↺ Regenerate
            </button>
            <button
              onClick={() => goStep(5)}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-500 hover:bg-slate-50 transition-colors"
            >
              Skip — I have my own
            </button>
            <button
              onClick={() => goStep(5)}
              className="flex-1 rounded-xl bg-blue-600 text-white py-2.5 text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              Add to Application →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 5: Review & Submit ── */}
      {wizard.step === 5 && selectedType && (
        <div className="space-y-5 animate-slide-up">
          <div>
            <h2 className="font-display text-2xl text-slate-900">Review & Submit</h2>
            <p className="text-slate-500 text-sm mt-1">Confirm the details before submitting your application.</p>
          </div>
          <div className="rounded-2xl bg-white border border-slate-100 divide-y divide-slate-50">
            {[
              { label: 'Destination', value: `${req.flag} ${req.country}` },
              { label: 'Visa Type', value: selectedType.name },
              { label: 'Processing', value: `${selectedType.processingDays} business days` },
              { label: 'Max Stay', value: selectedType.maxStay },
              { label: 'Documents', value: `${readyDocs}/${docs.length} ready${readyDocs < docs.length ? ' ⚠ Some pending' : ' ✓'}` },
              { label: 'Traveler', value: traveler.name ?? 'Arjun Mehta' },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between px-5 py-3.5">
                <span className="text-sm text-slate-500">{row.label}</span>
                <span className="text-sm font-medium text-slate-900">{row.value}</span>
              </div>
            ))}
          </div>
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 flex items-center gap-4">
            <div className="w-10 h-6 bg-blue-600 rounded flex items-center justify-center">
              <span className="text-white text-xs font-bold">VISA</span>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">Visa •••• 4242</p>
              <p className="text-xs text-slate-400">Saved card · Expires 12/26</p>
            </div>
            <button className="ml-auto text-xs text-blue-600 font-medium">Change</button>
          </div>
          <div className="flex gap-3">
            <button onClick={() => goStep(3)} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm text-slate-600 hover:bg-slate-50 transition-colors">← Back</button>
            <button
              onClick={handleSubmit}
              className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white py-3 text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Submit Application — ₹{selectedType.fee.toLocaleString('en-IN')}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 6: Confirmation ── */}
      {wizard.step === 6 && (
        <div className="space-y-6 text-center animate-slide-up py-8">
          <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <svg viewBox="0 0 48 48" className="w-12 h-12 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="24" cy="24" r="20" className="stroke-emerald-200" strokeWidth="2" />
              <path d="M14 24l7 7 13-14" className="stroke-emerald-500" />
            </svg>
          </div>
          <div>
            <h2 className="font-display text-2xl text-slate-900">Application Submitted!</h2>
            <p className="text-slate-500 text-sm mt-2">Your visa application is now under review.</p>
          </div>
          {wizard.draftApp.referenceNumber && (
            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 inline-block mx-auto">
              <p className="text-xs text-slate-500 mb-1">Reference Number</p>
              <p className="font-mono text-lg font-bold text-slate-900">{wizard.draftApp.referenceNumber}</p>
            </div>
          )}
          <div className="rounded-2xl bg-white border border-slate-100 p-5 text-left space-y-3 max-w-sm mx-auto">
            <p className="font-semibold text-slate-800 text-sm">What happens next</p>
            {['Document verification (1–3 days)', 'Appointment scheduling (if required)', 'Embassy review', 'Decision notification by email'].map((step, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-slate-600">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 font-bold text-xs flex items-center justify-center flex-shrink-0">{i + 1}</span>
                {step}
              </div>
            ))}
          </div>
          <button
            onClick={() => onFinish(wizard.draftApp as VisaApplication, wizard.draftApp.referenceNumber ?? '')}
            className="w-full max-w-sm rounded-xl bg-blue-600 text-white py-3 text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            View Application Status
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Home View ────────────────────────────────────────────────────────────────

function HomeView({
  onStartApply,
  onViewStatus,
}: {
  onStartApply: (req: VisaRequirement) => void;
  onViewStatus: (appId: string) => void;
}) {
  const { journeys, selectedJourneyId, visaApplications } = useApp();
  const [search, setSearch] = useState('');
  const [showAI, setShowAI] = useState(false);

  const activeJourney = journeys.find((j) => j.id === selectedJourneyId) ?? journeys.find((j) => j.status === 'pre-travel' || j.status === 'planning') ?? null;
  const journeyDestReq = activeJourney
    ? visaRequirements.find((r) => activeJourney.destination?.toLowerCase().includes(r.country.toLowerCase().split(' ')[0]))
    : null;

  const filtered = visaRequirements.filter((r) =>
    search === '' || r.country.toLowerCase().includes(search.toLowerCase())
  );

  const mockChatApp: VisaApplication = {
    id: 'mock',
    destinationId: 'general',
    country: 'General',
    visaTypeId: 'general',
    visaTypeName: 'Inquiry',
    status: 'draft',
    documents: [],
    fee: 0,
    processingDays: 0,
  };

  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <div className="bg-slate-950 text-white px-4 pt-12 pb-10">
        <div className="max-w-2xl mx-auto">
          <p className="text-slate-400 text-sm font-medium tracking-widest uppercase mb-3">Travalastic</p>
          <h1 className="font-display text-5xl sm:text-6xl mb-3">Visa Center</h1>
          <p className="text-slate-400 text-base leading-relaxed">All your visa applications and requirements, in one place.</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-10">
        {/* Journey banner */}
        {activeJourney && journeyDestReq && (
          <div className="rounded-2xl bg-gradient-to-r from-blue-50 to-violet-50 border border-blue-100 p-5 flex items-start gap-4">
            <span className="text-3xl">{journeyDestReq.flag}</span>
            <div className="flex-1">
              <p className="font-semibold text-slate-900 text-sm">Your {activeJourney.title ?? activeJourney.destination ?? 'upcoming'} journey may require a visa</p>
              <p className="text-slate-500 text-xs mt-0.5">Check requirements for {journeyDestReq.country} — {VISA_TYPE_LABEL[journeyDestReq.visaType]}</p>
            </div>
            <button
              onClick={() => onStartApply(journeyDestReq)}
              className="rounded-xl bg-blue-600 text-white text-xs font-semibold px-4 py-2 hover:bg-blue-700 transition-colors flex-shrink-0"
            >
              Check →
            </button>
          </div>
        )}

        {/* Active applications */}
        {visaApplications.length > 0 && (
          <section>
            <h2 className="font-display text-xl text-slate-900 mb-4">Your Applications</h2>
            <div className="space-y-3">
              {visaApplications.map((app) => (
                <div key={app.id} className="rounded-2xl bg-white border border-slate-100 p-5 flex items-center gap-4 hover:shadow-sm transition-shadow">
                  <div className="text-3xl flex-shrink-0">
                    {visaRequirements.find((r) => r.destinationId === app.destinationId)?.flag ?? '🌍'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900">{app.country}</p>
                    <p className="text-slate-500 text-sm">{app.visaTypeName}</p>
                    {app.referenceNumber && <p className="text-xs text-slate-400 font-mono mt-0.5">{app.referenceNumber}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[app.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {STATUS_LABELS[app.status] ?? app.status}
                    </span>
                    <button
                      onClick={() => onViewStatus(app.id)}
                      className="text-xs text-blue-600 font-medium hover:underline"
                    >
                      View Status →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Destination selector */}
        <section>
          <h2 className="font-display text-xl text-slate-900 mb-1">Check Visa Requirements</h2>
          <p className="text-slate-500 text-sm mb-4">Search destinations and start your visa application.</p>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search destination..."
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map((req) => (
              <div key={req.destinationId} className="rounded-2xl bg-white border border-slate-100 p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start gap-3">
                  <span className="text-3xl flex-shrink-0">{req.flag}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm leading-tight">{req.country}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${VISA_TYPE_BADGE[req.visaType]}`}>
                        {VISA_TYPE_LABEL[req.visaType]}
                      </span>
                      {req.processingDays !== undefined && req.processingDays > 0 && (
                        <span className="text-xs text-slate-400">{req.processingDays} day processing</span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => onStartApply(req)}
                  className="mt-3 w-full rounded-xl bg-slate-900 text-white py-2 text-xs font-semibold hover:bg-slate-700 transition-colors"
                >
                  Apply / View Details
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Visa AI button */}
        <div className="rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 text-white p-6 text-center">
          <p className="font-display text-xl mb-1">Visa AI Assistant</p>
          <p className="text-violet-200 text-sm mb-4">Ask anything about visa requirements, processing times, and document preparation.</p>
          <button
            onClick={() => setShowAI(true)}
            className="rounded-xl bg-white text-violet-700 font-semibold text-sm px-6 py-2.5 hover:bg-violet-50 transition-colors"
          >
            Chat with Visa AI
          </button>
        </div>
      </div>

      {showAI && <AIChatModal app={mockChatApp} onClose={() => setShowAI(false)} />}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VisaCenterPage() {
  const { visaApplications } = useApp();
  const [view, setView] = useState<ViewMode>('home');
  const [selectedReq, setSelectedReq] = useState<VisaRequirement | null>(null);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [showAI, setShowAI] = useState(false);
  const [submittedApp, setSubmittedApp] = useState<VisaApplication | null>(null);

  const selectedApp = visaApplications.find((a) => a.id === selectedAppId) ?? submittedApp ?? null;

  function startApply(req: VisaRequirement) {
    setSelectedReq(req);
    setView('apply');
  }

  function handleFinish(app: VisaApplication, _refNum: string) {
    setSubmittedApp(app);
    setSelectedAppId(app.id);
    setView('status');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {view === 'home' && (
        <HomeView
          onStartApply={startApply}
          onViewStatus={(id) => { setSelectedAppId(id); setView('status'); }}
        />
      )}

      {view === 'apply' && selectedReq && (
        <ApplyWizard
          initialReq={selectedReq}
          onFinish={handleFinish}
          onCancel={() => setView('home')}
        />
      )}

      {view === 'status' && selectedApp && (
        <>
          <StatusView
            app={selectedApp}
            onBack={() => setView('home')}
            onAskAI={() => setShowAI(true)}
          />
          {showAI && <AIChatModal app={selectedApp} onClose={() => setShowAI(false)} />}
        </>
      )}

      {view === 'status' && !selectedApp && (
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <p className="text-slate-400">Application not found.</p>
          <button onClick={() => setView('home')} className="mt-4 text-blue-600 text-sm font-medium hover:underline">← Back to Visa Center</button>
        </div>
      )}
    </div>
  );
}
