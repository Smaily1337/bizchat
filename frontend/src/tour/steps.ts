export type TourStep = {
  id: string;
  title: string;
  body: string;
  /** Route to open before highlighting (optional) */
  route?: string;
  /** CSS selector for spotlight target, e.g. [data-tour="nav-inbox"] */
  target?: string;
  placement?: "bottom" | "top" | "left" | "right" | "center";
};

export const TOUR_STORAGE_KEY = "bizchat_tour_v1";

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Witaj w BizChat",
    body: "Krótki samouczek pokaże, gdzie rezerwujesz wizyty, odpowiadasz klientom i podłączasz Messenger, Telegram oraz widget na stronę.",
    route: "/",
    placement: "center",
  },
  {
    id: "calendar",
    title: "Kalendarz",
    body: "Tu widzisz dzień lub tydzień wizyt. Kliknij wizytę, żeby zobaczyć szczegóły, albo przejdź do listy w zakładce Wizyty.",
    route: "/",
    target: '[data-tour="nav-calendar"]',
    placement: "bottom",
  },
  {
    id: "appointments",
    title: "Wizyty",
    body: "Lista wszystkich rezerwacji: statusy, klient, usługa. Stąd potwierdzasz, odwołujesz i śledzisz dzień pracy.",
    route: "/appointments",
    target: '[data-tour="nav-appointments"]',
    placement: "bottom",
  },
  {
    id: "inbox",
    title: "Inbox",
    body: "Tu lądują rozmowy z bota i klientów. Możesz odpisać ręcznie albo użyć „Nowa wiadomość”, by napisać do klienta na Messenger bez wcześniejszego wątku.",
    route: "/inbox",
    target: '[data-tour="nav-inbox"]',
    placement: "bottom",
  },
  {
    id: "customers",
    title: "Klienci",
    body: "Dodaj klienta ręcznie (imię, telefon, e-mail) i wklej Messenger PSID. Potem wyślij wiadomość z poziomu karty klienta — nawet jeśli nie macie jeszcze rozmowy w Inbox.",
    route: "/customers",
    target: '[data-tour="nav-customers"]',
    placement: "bottom",
  },
  {
    id: "hours",
    title: "Godziny",
    body: "Ustaw godziny otwarcia i urlopy. Bot proponuje tylko wolne sloty w tych ramach.",
    route: "/hours",
    target: '[data-tour="nav-hours"]',
    placement: "bottom",
  },
  {
    id: "channels",
    title: "Kanały",
    body: "Podłącz Messenger, WhatsApp, Telegram i widget. Skopiuj webhooki i ustaw tokeny env. Publiczna rezerwacja: /book/slug z Ustawień.",
    route: "/channels",
    target: '[data-tour="nav-channels"]',
    placement: "bottom",
  },
  {
    id: "staff",
    title: "Zespół",
    body: "Dodaj stylistów — wtedy możesz przypisywać wizyty do konkretnej osoby i filtrować wolne sloty.",
    route: "/staff",
    target: '[data-tour="nav-staff"]',
    placement: "bottom",
  },
  {
    id: "reports",
    title: "Raporty",
    body: "Wizyty, no-show i kanały za 7/30/90 dni — z eksportem CSV.",
    route: "/reports",
    target: '[data-tour="nav-reports"]',
    placement: "bottom",
  },
  {
    id: "notifications",
    title: "Powiadomienia",
    body: "Szablony SMS / e-mail / Messenger / WhatsApp. Reminder na Messengerze ma przyciski Potwierdzam / Odwołuję.",
    route: "/notifications",
    target: '[data-tour="nav-notifications"]',
    placement: "bottom",
  },
  {
    id: "settings",
    title: "Ustawienia",
    body: "Nazwa salonu, strefa czasowa, usługi i baza wiedzy (FAQ) — bot korzysta z tego przy umawianiu i odpowiedziach.",
    route: "/settings",
    target: '[data-tour="nav-settings"]',
    placement: "bottom",
  },
  {
    id: "done",
    title: "Gotowe",
    body: "To wszystko na start. Samouczek możesz uruchomić ponownie z przycisku „Samouczek” w górnym pasku albo z sekcji Kanały.",
    route: "/",
    placement: "center",
  },
];
