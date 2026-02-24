'use client';

export const Input = ({ label, type = "text", value, onChange, placeholder, required = false, disabled = false, className = "", error }) => (
    <div className={`space-y-1.5 ${className}`}>
        {label && (
            <label className="block text-xs font-semibold text-slate-700 ml-1">
                {label} {required && <span className="text-rose-500 font-bold">*</span>}
            </label>
        )}
        <div className="relative group">
            <input
                type={type}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                required={required}
                disabled={disabled}
                className={`w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200 hover:border-slate-300 disabled:bg-slate-50 disabled:cursor-not-allowed ${error ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/10' : ''}`}
            />
            {error && (
                <p className="mt-1 text-[10px] font-medium text-rose-500 ml-1 italic">{error}</p>
            )}
        </div>
    </div>
);
