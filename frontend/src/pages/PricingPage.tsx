import React from 'react';

export function PricingPage() {
  return (
    <div className="min-h-screen bg-[#131315] text-[#e5e1e4] font-sans overflow-hidden relative py-20 px-6">
      {/* Background orbs */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/10 blur-[120px] rounded-full pointer-events-none mix-blend-screen" />
      
      <div className="max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-20">
          <h1 className="text-display-lg font-display font-bold mb-4 bg-gradient-to-r from-primary via-primary-fixed to-[#a078ff] bg-clip-text text-transparent">
            Wybierz swój plan
          </h1>
          <p className="text-body-md text-on-surface-variant max-w-xl mx-auto">
            Proste, przejrzyste ceny dostosowane do rozmiaru Twojego salonu. Możesz zmienić plan w dowolnym momencie.
          </p>
        </div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-32">
          {/* Starter Plan */}
          <div className="glass-panel rounded-[28px] p-8 flex flex-col hover:border-white/20 hover:shadow-glow transition-all">
            <h3 className="text-xl font-bold text-on-surface mb-2">Starter</h3>
            <div className="mb-6">
              <span className="text-4xl font-display font-bold">$49</span>
              <span className="text-on-surface-variant">/mc</span>
            </div>
            <p className="text-sm text-on-surface-variant mb-8 h-10">Idealny dla małych, rozwijających się salonów z pojedynczą lokalizacją.</p>
            
            <button className="w-full py-3 px-6 rounded-full border border-white/10 hover:bg-white/5 transition-colors font-medium mb-8">
              Wybierz Starter
            </button>

            <div className="space-y-4 flex-1">
              {['Zarządzanie do 50 pojazdów', 'Podstawowy CRM', 'Kalendarz jazd testowych', 'Wsparcie email'].map((feat, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-secondary text-xl">check</span>
                  <span className="text-sm">{feat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pro Plan */}
          <div className="glass-panel rounded-[28px] p-8 flex flex-col relative border-primary/30 shadow-[0_0_30px_rgba(128,131,255,0.15)] transform md:-translate-y-4">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-[linear-gradient(135deg,#8083ff,#494bd6)] rounded-full text-xs font-bold uppercase tracking-wider text-white">
              Najpopularniejszy
            </div>
            <h3 className="text-xl font-bold text-primary mb-2">Pro</h3>
            <div className="mb-6">
              <span className="text-4xl font-display font-bold">$99</span>
              <span className="text-on-surface-variant">/mc</span>
            </div>
            <p className="text-sm text-on-surface-variant mb-8 h-10">Pełen pakiet narzędzi dla średnich i dużych dealerów motoryzacyjnych.</p>
            
            <button className="w-full py-3 px-6 rounded-full bg-[linear-gradient(135deg,#8083ff,#494bd6)] text-white hover:shadow-glow transition-all font-medium mb-8">
              Rozpocznij z Pro
            </button>

            <div className="space-y-4 flex-1">
              {[
                'Nielimitowane pojazdy', 
                'Zaawansowany CRM i analityka', 
                'Automatyzacja marketingu', 
                'Wielu użytkowników i role',
                'Priorytetowe wsparcie 24/7'
              ].map((feat, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-secondary text-xl">check</span>
                  <span className="text-sm">{feat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Enterprise Plan */}
          <div className="glass-panel rounded-[28px] p-8 flex flex-col hover:border-white/20 hover:shadow-glow transition-all">
            <h3 className="text-xl font-bold text-on-surface mb-2">Enterprise</h3>
            <div className="mb-6">
              <span className="text-4xl font-display font-bold text-transparent bg-gradient-to-r from-primary to-[#a078ff] bg-clip-text">Kontakt</span>
            </div>
            <p className="text-sm text-on-surface-variant mb-8 h-10">Dedykowane rozwiązanie dla sieci dealerskich i importerów.</p>
            
            <button className="w-full py-3 px-6 rounded-full border border-white/10 hover:bg-white/5 transition-colors font-medium mb-8">
              Skontaktuj się z nami
            </button>

            <div className="space-y-4 flex-1">
              {[
                'Wszystko z planu Pro', 
                'Dedykowany Account Manager', 
                'Własne integracje API', 
                'Gwarancja SLA (99.9%)',
                'Szkolenia on-site dla zespołu'
              ].map((feat, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-secondary text-xl">check</span>
                  <span className="text-sm">{feat}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Checkout Section */}
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="glass-panel rounded-[28px] p-8">
            <h2 className="text-xl font-bold mb-6">Płatność</h2>
            <form className="space-y-4">
              <div>
                <label className="block text-xs font-label-caps text-on-surface-variant mb-2">Adres email</label>
                <input 
                  type="email" 
                  disabled
                  value="test@example.com"
                  className="w-full bg-surface-container/60 border border-white/10 rounded-lg px-4 py-3 text-on-surface outline-none focus:border-primary/50 transition-colors opacity-70"
                />
              </div>
              <div>
                <label className="block text-xs font-label-caps text-on-surface-variant mb-2">Dane karty</label>
                <div className="w-full bg-surface-container/60 border border-white/10 rounded-lg px-4 py-3 flex items-center gap-3 opacity-70">
                   <span className="material-symbols-outlined text-on-surface-variant">credit_card</span>
                   <span className="text-on-surface tracking-widest font-data-mono">•••• •••• •••• 4242</span>
                   <div className="flex-1" />
                   <span className="text-on-surface-variant text-sm font-data-mono">12/25</span>
                   <span className="text-on-surface-variant text-sm font-data-mono">CVC</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-label-caps text-on-surface-variant mb-2">Imię i nazwisko posiadacza</label>
                <input 
                  type="text" 
                  disabled
                  value="Jan Kowalski"
                  className="w-full bg-surface-container/60 border border-white/10 rounded-lg px-4 py-3 text-on-surface outline-none opacity-70"
                />
              </div>
              <button 
                type="button"
                className="w-full mt-4 py-4 rounded-full bg-[linear-gradient(135deg,#8083ff,#494bd6)] text-white font-bold hover:shadow-glow transition-all flex justify-center items-center gap-2"
              >
                <span className="material-symbols-outlined">lock</span>
                Zapłać $99.00
              </button>
            </form>
          </div>

          <div className="glass-panel rounded-[28px] p-8 bg-gradient-to-br from-surface-container/60 to-primary/5">
            <h2 className="text-xl font-bold mb-6">Podsumowanie zamówienia</h2>
            <div className="space-y-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant">Plan Pro (Miesięcznie)</span>
                <span className="font-bold">$99.00</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant">Opłata instalacyjna</span>
                <span className="text-secondary">Za darmo</span>
              </div>
              <div className="h-px w-full bg-white/10 my-2" />
              <div className="flex justify-between items-center text-lg">
                <span className="font-bold">Razem do zapłaty</span>
                <span className="font-display font-bold text-primary">$99.00</span>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-4 rounded-xl bg-[#131315]/50 border border-white/5">
              <span className="material-symbols-outlined text-secondary">verified_user</span>
              <div>
                <p className="text-sm font-medium mb-1">Gwarancja bezpiecznej płatności</p>
                <p className="text-xs text-on-surface-variant">Twoje dane są szyfrowane i bezpieczne. Możesz zrezygnować w każdej chwili.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
