import React, { useState } from 'react';
import { X, Save, Database, AlertTriangle, Copy, Check } from 'lucide-react';
import { SupabaseConfig } from '../types';

interface DatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: SupabaseConfig) => void;
  currentConfig?: SupabaseConfig | null;
}

const DatabaseModal: React.FC<DatabaseModalProps> = ({ isOpen, onClose, onSave, currentConfig }) => {
  const [url, setUrl] = useState(currentConfig?.supabaseUrl || '');
  const [key, setKey] = useState(currentConfig?.supabaseKey || '');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!url || !key) {
      alert("Zəhmət olmasa URL və Key daxil edin.");
      return;
    }
    onSave({ supabaseUrl: url, supabaseKey: key });
    onClose();
  };

  const sqlCode = `create table if not exists app_settings (
  id text primary key,
  data jsonb
);

-- RLS (Təhlükəsizlik) Aktivləşdir
alter table app_settings enable row level security;

-- XƏTA HƏLLİ: Əgər policy artıq varsa, əvvəl sil, sonra yenidən yarat
drop policy if exists "Public Access" on app_settings;
drop policy if exists "public_access_all" on app_settings;

-- Hər kəsə (Anonim) oxuma/yazma icazəsi ver
create policy "Public Access" on app_settings 
  for all 
  using (true) 
  with check (true);

-- Realtime abunəliyi (Əgər əlavə olunmayıbsa)
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'app_settings') then
    alter publication supabase_realtime add table app_settings;
  end if;
end
$$;`;

  const copySql = () => {
    navigator.clipboard.writeText(sqlCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-900 opacity-75"></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center gap-2">
                <Database className="w-5 h-5 text-green-600" />
                Supabase Bağlantısı
              </h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-6 bg-blue-50 p-4 rounded-lg text-sm text-blue-800 border border-blue-100">
              <p className="flex items-center gap-2 font-bold mb-2">
                <AlertTriangle className="w-4 h-4" />
                Qurulum Təlimatı (Yalnız 1 dəfə):
              </p>
              <ol className="list-decimal ml-5 space-y-1 text-xs text-blue-700">
                <li><a href="https://supabase.com/dashboard" target="_blank" className="underline font-bold">Supabase.com</a>-da pulsuz layihə yaradın.</li>
                <li>Soldakı menyudan <strong>SQL Editor</strong>-ə girin.</li>
                <li>Aşağıdaki kodu yapışdırın və <strong>Run</strong> düyməsinə basın:</li>
              </ol>

              <div className="mt-2 relative">
                <pre className="bg-gray-800 text-gray-100 p-2 rounded text-[10px] overflow-x-auto">
{sqlCode}
                </pre>
                <button 
                  onClick={copySql}
                  className="absolute top-1 right-1 p-1 bg-white/10 rounded hover:bg-white/20 text-white transition-colors"
                  title="Kodu kopyala"
                >
                  {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project URL
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-green-500 focus:border-green-500 text-sm"
                  placeholder="https://xyz.supabase.co"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Key (anon / public)
                </label>
                <input
                  type="password"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-green-500 focus:border-green-500 text-sm"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI..."
                />
              </div>
            </div>

            <div className="mt-5 sm:mt-6">
              <button
                onClick={handleSave}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none sm:text-sm"
              >
                <Save className="w-4 h-4 mr-2" />
                Yadda Saxla və Bağlan
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatabaseModal;