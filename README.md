# TheyCallMeMiku

> An Italian-speaking Hatsune Miku chatbot with a 3D avatar, built because our teacher said it was a good idea. :3
>
> Made with love and pure hatred by [@Adrik-LOL](https://github.com/Adrik-LOL) and [@gloryxxx](https://github.com/gloryxxx), for the middle-school adventurers curious about what we do at our school.
>
> Most of this project was vibe-coded to save time, but two expert eyes reviewed the work, cutting or adding anything the AI came up with.

> Un chatbot di Hatsune Miku con un avatar 3D, creato perché il prof ha detto che era una buona idea. :3
>
> Fatto con amore e puro odio da [@Adrik-LOL](https://github.com/Adrik-LOL) e [@gloryxxx](https://github.com/gloryxxx), per gli avventurieri delle scuole medie che vogliono scoprire cosa si fa nella nostra scuola.
>
> Il programma è stato in gran parte vibecoddato per risparmiare tempo, ma dietro c'è l'occhio clinico di due esperti, che hanno tagliato o aggiunto tutto ciò che l'IA ha combinato.
>

The app is currently available **only in Italian**. / L'applicazione è attualmente disponibile **solo in italiano**.

---

## Funzionalità

- Chat con Miku tramite l'API di OpenAI.
- Miku ricorda il contesto della sessione corrente, mantenendo gli ultimi sei scambi. La memoria si azzera quando ricarichi la pagina.
- Avatar 3D in formato VRM, con animazioni idle e parlato.
- Sintesi vocale tramite le voci disponibili nel browser.

Il progetto è ancora in sviluppo:

- **Speech-to-text:** non ancora implementato.
- **Voce RVC:** non ancora integrata. I file `.pth` e `.index` non sono inclusi su GitHub perché troppo grandi e vanno scaricati separatamente da Hugging Face.
- **Easter egg:** altri sono in programma. Per ora, Miku tifa Calcio Catania.

### Download dei file RVC

1. Apri la [pagina del modello HatsuneMikuRVC su Hugging Face](https://huggingface.co/aple/HatsuneMikuRVC).
2. Scarica l'archivio `miku_power_rvc.zip` dalla sezione dei modelli vocali.
3. Estrai i file `.pth` e `.index` dell'archivio nella cartella `miku/`, mantenendo questi nomi:

	- `miku_power_rvc.pth`
	- `added_IVF10688_Flat_nprobe_1_miku_power_rvc_v2.index`

Questi file restano sul tuo computer e non vengono caricati su GitHub. L'integrazione RVC nell'app è ancora da realizzare.

## Requisiti

- Node.js e npm
- Una chiave API di OpenAI
- Un browser con supporto WebGL e Web Speech API per l'avatar e la sintesi vocale

## Installazione e avvio

Clona il repository e installa le dipendenze:

```bash
git clone https://github.com/Adrik-LOL/TheyCallMeMiku.git
cd TheyCallMeMiku
npm install
```

Crea un file `.env` nella cartella principale del progetto e inserisci la tua chiave API:

```env
OPENAI_KEY=la-tua-chiave-api
```

> Non condividere la chiave API e non inserirla nei commit.

Avvia il server:

```bash
node run.js
```

> Apri [http://localhost:3000](http://localhost:3000) nel browser.

## Crediti

- Chatbot e progetto: [@Adrik-LOL](https://github.com/Adrik-LOL) e [@gloryxxx](https://github.com/gloryxxx).
- Modello RVC di Miku: [aple/HatsuneMikuRVC](https://huggingface.co/aple/HatsuneMikuRVC).
- Strumento per la conversione FBX in VRMA: [fbx2vrma-converter](https://github.com/tk256ailab/fbx2vrma-converter).

> We're so sorry, we silly bakas don't know who made the VRM model for the avatar! If it's yours, please open an issue so we can give you proper credit. We're really sorry about the mix-up, and we'll gladly add your name! >_<