import React, { useEffect, useRef } from 'react';

export function LandingPage() {
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('opacity-100', 'translate-y-0');
          entry.target.classList.remove('opacity-0', 'translate-y-10');
        }
      });
    });

    const elements = document.querySelectorAll('.animate-fade-up');
    elements.forEach((el) => observerRef.current?.observe(el));

    return () => observerRef.current?.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[#131315] text-[#e5e1e4] font-sans overflow-hidden relative">
      {/* Background orbs */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-[#a078ff]/10 blur-[120px] rounded-full pointer-events-none mix-blend-screen" />

      {/* Navigation */}
      <nav className="fixed top-4 left-4 right-4 z-50 rounded-full glass-panel px-6 py-4 flex items-center justify-between transition-all duration-300 hover:border-white/20 hover:shadow-glow">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-2xl">directions_car</span>
          <span className="text-primary font-display font-bold text-xl tracking-tight">Automovia</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-on-surface-variant text-label-caps font-label-caps">
          <a href="#features" className="hover:text-primary transition-colors">Funkcje</a>
          <a href="#pricing" className="hover:text-primary transition-colors">Cennik</a>
          <a href="#about" className="hover:text-primary transition-colors">O nas</a>
        </div>
        <div className="flex items-center gap-4">
          <button className="text-on-surface-variant hover:text-on-surface transition-colors font-label-caps text-label-caps">Zaloguj</button>
          <button className="px-5 py-2 rounded-full bg-[linear-gradient(135deg,#8083ff,#494bd6)] text-white font-medium hover:shadow-glow transition-all">
            Rozpocznij
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="pt-40 pb-20 px-6 relative z-10 flex flex-col items-center text-center max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 mb-8 animate-fade-up opacity-0 translate-y-10 transition-all duration-700">
          <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
          <span className="text-primary text-sm font-medium">Wersja 2.0 już dostępna</span>
        </div>

        <h1 className="text-display-lg font-display font-bold leading-tight mb-6 animate-fade-up opacity-0 translate-y-10 transition-all duration-700 delay-100">
          <span className="bg-gradient-to-r from-primary via-[#a078ff] to-[#c0c1ff] bg-clip-text text-transparent">Wznieś Doświadczenie</span><br />
          Swojego Salonu na Wyższy Poziom
        </h1>
        
        <p className="text-body-md text-on-surface-variant max-w-2xl mb-10 animate-fade-up opacity-0 translate-y-10 transition-all duration-700 delay-200">
          Kompleksowy system zarządzania salonem samochodowym. Automatyzacja spotkań, jazdy testowe, analiza danych i więcej w jednym potężnym narzędziu.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 mb-20 animate-fade-up opacity-0 translate-y-10 transition-all duration-700 delay-300">
          <button className="px-8 py-4 rounded-full bg-[linear-gradient(135deg,#8083ff,#494bd6)] text-white font-medium text-lg hover:shadow-glow transition-all w-full sm:w-auto">
            Wypróbuj za darmo
          </button>
          <button className="px-8 py-4 rounded-full glass-panel text-on-surface font-medium text-lg hover:border-white/20 hover:shadow-glow transition-all w-full sm:w-auto flex items-center justify-center gap-2">
            <span className="material-symbols-outlined">play_circle</span>
            Zobacz demo
          </button>
        </div>

        {/* Dashboard Preview Mockup */}
        <div className="w-full relative animate-fade-up opacity-0 translate-y-10 transition-all duration-1000 delay-500">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent blur-3xl -z-10 rounded-[40px]" />
          <div className="glass-panel rounded-[28px] p-2 border-white/20 shadow-2xl">
            <div className="bg-[#1a1a1c] rounded-3xl overflow-hidden border border-white/5 flex flex-col h-[600px]">
              {/* Mock App Header */}
              <div className="h-14 border-b border-white/5 flex items-center px-6 gap-4">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-error" />
                  <div className="w-3 h-3 rounded-full bg-[#fbbc04]" />
                  <div className="w-3 h-3 rounded-full bg-secondary" />
                </div>
                <div className="flex-1" />
                <div className="h-6 w-64 glass-panel rounded-full" />
                <div className="w-8 h-8 rounded-full bg-primary/20" />
              </div>
              {/* Mock App Content */}
              <div className="flex-1 p-8 flex gap-6">
                <div className="w-64 flex flex-col gap-4">
                  <div className="h-10 glass-panel rounded-lg w-full" />
                  <div className="h-10 glass-panel rounded-lg w-full" />
                  <div className="h-10 glass-panel rounded-lg w-full opacity-50" />
                  <div className="h-10 glass-panel rounded-lg w-full opacity-50" />
                </div>
                <div className="flex-1 flex flex-col gap-6">
                  <div className="grid grid-cols-3 gap-6">
                    <div className="glass-panel rounded-2xl p-6 h-32 flex flex-col justify-between relative overflow-hidden">
                      <div className="text-on-surface-variant font-label-caps text-label-caps">Sprzedaż</div>
                      <div className="font-kpi-stat text-kpi-stat">24</div>
                      <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-primary/10 blur-xl rounded-full" />
                    </div>
                    <div className="glass-panel rounded-2xl p-6 h-32 flex flex-col justify-between">
                      <div className="text-on-surface-variant font-label-caps text-label-caps">Jazdy testowe</div>
                      <div className="font-kpi-stat text-kpi-stat">12</div>
                    </div>
                    <div className="glass-panel rounded-2xl p-6 h-32 flex flex-col justify-between">
                      <div className="text-on-surface-variant font-label-caps text-label-caps">Odwiedziny</div>
                      <div className="font-kpi-stat text-kpi-stat">156</div>
                    </div>
                  </div>
                  <div className="flex-1 glass-panel rounded-2xl p-6">
                    <div className="h-full w-full bg-gradient-to-r from-primary-container/20 to-tertiary-container/20 rounded-xl" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Floating Elements on Mockup */}
          <div className="absolute -right-12 top-32 glass-panel rounded-2xl p-4 shadow-xl animate-bounce" style={{animationDuration: '3s'}}>
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center">
                 <span className="material-symbols-outlined text-secondary">check</span>
               </div>
               <div>
                 <div className="text-sm font-medium">Jazda potwierdzona</div>
                 <div className="text-xs text-on-surface-variant">Dzisiaj 14:30</div>
               </div>
             </div>
          </div>
        </div>
      </main>

      {/* Bento Grid Features */}
      <section id="features" className="py-32 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-16 animate-fade-up opacity-0 translate-y-10 transition-all duration-700">
          <h2 className="text-headline-md font-display font-bold mb-4">Wszystko, czego potrzebujesz</h2>
          <p className="text-body-md text-on-surface-variant">Zaprojektowane, by przyspieszyć Twoją sprzedaż.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[250px]">
          <div className="md:col-span-2 glass-panel rounded-[28px] p-8 flex flex-col justify-between group hover:border-white/20 hover:shadow-glow transition-all animate-fade-up opacity-0 translate-y-10 transition-all duration-700">
            <span className="material-symbols-outlined text-4xl text-primary mb-4 group-hover:scale-110 transition-transform">calendar_month</span>
            <div>
              <h3 className="text-xl font-bold mb-2">Inteligentny Kalendarz</h3>
              <p className="text-on-surface-variant">Automatyczne zarządzanie jazdami testowymi, przeglądami i spotkaniami w jednym miejscu. Zero pomyłek, pełna kontrola.</p>
            </div>
          </div>

          <div className="glass-panel rounded-[28px] p-8 flex flex-col justify-between group hover:border-white/20 hover:shadow-glow transition-all animate-fade-up opacity-0 translate-y-10 transition-all duration-700 delay-100">
            <span className="material-symbols-outlined text-4xl text-[#a078ff] mb-4 group-hover:scale-110 transition-transform">query_stats</span>
            <div>
              <h3 className="text-xl font-bold mb-2">Analityka</h3>
              <p className="text-on-surface-variant text-sm">Śledź konwersje i KPI zespołu w czasie rzeczywistym.</p>
            </div>
          </div>

          <div className="glass-panel rounded-[28px] p-8 flex flex-col justify-between group hover:border-white/20 hover:shadow-glow transition-all animate-fade-up opacity-0 translate-y-10 transition-all duration-700 delay-200">
            <span className="material-symbols-outlined text-4xl text-secondary mb-4 group-hover:scale-110 transition-transform">payments</span>
            <div>
              <h3 className="text-xl font-bold mb-2">Finanse</h3>
              <p className="text-on-surface-variant text-sm">Zintegrowane płatności i zarządzanie fakturami klientów.</p>
            </div>
          </div>

          <div className="md:col-span-2 glass-panel rounded-[28px] p-8 flex flex-col justify-between group hover:border-white/20 hover:shadow-glow transition-all animate-fade-up opacity-0 translate-y-10 transition-all duration-700 delay-300 relative overflow-hidden">
            <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l from-primary/5 to-transparent pointer-events-none" />
            <span className="material-symbols-outlined text-4xl text-[#c0c1ff] mb-4 group-hover:scale-110 transition-transform relative z-10">group</span>
            <div className="relative z-10">
              <h3 className="text-xl font-bold mb-2">CRM dla motoryzacji</h3>
              <p className="text-on-surface-variant">Profilowanie klientów, historia preferencji i automatyczne przypomnienia budujące długotrwałe relacje.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
