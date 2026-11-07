import { useApp } from '../../store/AppContext';
import { DELETE_ACCOUNT_HTML, IS_DRAFT } from './legalContent';

export default function DeleteAccountPage() {
  const { navigate } = useApp();

  return (
    <div className="min-h-screen bg-[#F7F5F0] py-10 px-4 sm:px-6 lg:px-8 text-[#252525]">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-[#E8E4DC] overflow-hidden">
        {IS_DRAFT && (
          <div className="bg-amber-100 border-b border-amber-300 text-amber-900 px-6 py-3.5 text-xs font-semibold tracking-wide uppercase flex items-center justify-between">
            <span>DRAFT: NOT FOR PUBLICATION. Company name and/or support email not set.</span>
            <span className="text-[10px] px-2 py-0.5 bg-amber-200 rounded">Pre-Submission</span>
          </div>
        )}

        <div className="p-6 sm:p-10">
          <div className="mb-6">
            <button
              onClick={() => navigate('home')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#77736C] hover:text-[#111111] transition-colors mb-4"
            >
              <span>←</span>
              <span>Back to Home</span>
            </button>
          </div>

          <div
            className="legal-content prose prose-slate max-w-none prose-headings:font-display prose-headings:text-[#111111] prose-h1:text-3xl prose-h2:text-xl prose-h2:mt-8 prose-h3:text-base prose-p:text-sm prose-p:leading-relaxed prose-li:text-sm"
            dangerouslySetInnerHTML={{ __html: DELETE_ACCOUNT_HTML }}
          />
        </div>
      </div>
    </div>
  );
}

