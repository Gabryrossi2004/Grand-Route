// Font per i 10 stili grafici del viaggio. Ogni tema ha un font per i titoli
// e uno per il testo, caricati una sola volta qui (Next.js li ottimizza e li
// serve dal nostro dominio, nessuna chiamata a Google a runtime).
// Le variabili CSS generate vengono poi lette da src/app/themes.css in base
// al tema attivo (data-theme sul contenitore).
import {
  Playfair_Display,
  Lora,
  Yeseva_One,
  Nunito_Sans,
  Baloo_2,
  Mulish,
  Cinzel,
  Work_Sans,
  Cinzel_Decorative,
  EB_Garamond,
  Fjalla_One,
  Karla,
  Oswald,
  Inter,
  Marcellus,
  Jost,
  Cormorant_Garamond,
  Noto_Sans,
  Pacifico,
  Quicksand,
} from "next/font/google";

const eleganteHeading = Playfair_Display({ subsets: ["latin"], variable: "--font-elegante-heading" });
const eleganteBody = Lora({ subsets: ["latin"], variable: "--font-elegante-body" });

const aztecoHeading = Yeseva_One({ subsets: ["latin"], weight: "400", variable: "--font-azteco-heading" });
const aztecoBody = Nunito_Sans({ subsets: ["latin"], variable: "--font-azteco-body" });

const giunglaHeading = Baloo_2({ subsets: ["latin"], variable: "--font-giungla-heading" });
const giunglaBody = Mulish({ subsets: ["latin"], variable: "--font-giungla-body" });

const desertoHeading = Cinzel({ subsets: ["latin"], variable: "--font-deserto-heading" });
const desertoBody = Work_Sans({ subsets: ["latin"], variable: "--font-deserto-body" });

const egizioHeading = Cinzel_Decorative({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-egizio-heading" });
const egizioBody = EB_Garamond({ subsets: ["latin"], variable: "--font-egizio-body" });

const nordicoHeading = Fjalla_One({ subsets: ["latin"], weight: "400", variable: "--font-nordico-heading" });
const nordicoBody = Karla({ subsets: ["latin"], variable: "--font-nordico-body" });

const cittaHeading = Oswald({ subsets: ["latin"], variable: "--font-citta-heading" });
const cittaBody = Inter({ subsets: ["latin"], variable: "--font-citta-body" });

const maroccoHeading = Marcellus({ subsets: ["latin"], weight: "400", variable: "--font-marocco-heading" });
const maroccoBody = Jost({ subsets: ["latin"], variable: "--font-marocco-body" });

const giapponeseHeading = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-giapponese-heading" });
const giapponeseBody = Noto_Sans({ subsets: ["latin"], variable: "--font-giapponese-body" });

const tropicaleHeading = Pacifico({ subsets: ["latin"], weight: "400", variable: "--font-tropicale-heading" });
const tropicaleBody = Quicksand({ subsets: ["latin"], variable: "--font-tropicale-body" });

// Classi di tutte le variabili dei font, da applicare al contenitore della
// pagina che userà i temi (pagina pubblica, overview). Il CSS sceglie quale
// coppia usare in base al tema attivo.
export const themeFontVariables = [
  eleganteHeading.variable,
  eleganteBody.variable,
  aztecoHeading.variable,
  aztecoBody.variable,
  giunglaHeading.variable,
  giunglaBody.variable,
  desertoHeading.variable,
  desertoBody.variable,
  egizioHeading.variable,
  egizioBody.variable,
  nordicoHeading.variable,
  nordicoBody.variable,
  cittaHeading.variable,
  cittaBody.variable,
  maroccoHeading.variable,
  maroccoBody.variable,
  giapponeseHeading.variable,
  giapponeseBody.variable,
  tropicaleHeading.variable,
  tropicaleBody.variable,
].join(" ");
