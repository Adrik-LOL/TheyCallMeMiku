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
- Supporto per la voce di Miku: la sintesi vocale locale con SAPI 5 di Windows viene convertita con RVC e riprodotta nel browser con l'animazione sincronizzata.

Il progetto è ancora in sviluppo:

- **Speech-to-text:** non ancora implementato.
- **Easter egg:** altri sono in programma. Per ora, Miku tifa Calcio Catania.

### Configurazione della voce RVC

Per configurare RVC e scaricare automaticamente i file necessari, apri il **Prompt dei comandi (CMD)** nella cartella del progetto ed esegui:

```bat
setupRVC.bat
```

Lo script richiede Git, Python 3.12 e FFmpeg installati e disponibili nel `PATH`. Segui le istruzioni mostrate dal setup; al termine, RVC e il modello vocale di Miku saranno pronti. Il modello è troppo grande per GitHub e viene escluso da Git.

## Requisiti

- Node.js e npm
- Una chiave API di OpenAI
- Windows con una voce SAPI 5 installata (preferibilmente italiana)
- Git, Python 3.12 e FFmpeg disponibili nel `PATH` per configurare RVC
- Un browser con supporto WebGL per l'avatar e la riproduzione audio

## Installazione e avvio

Per installare TheyCallMeMiku, assicurati di avere almeno **25 GB di spazio libero**.

Clona il repository e installa le dipendenze:

```bash
git clone https://github.com/Adrik-LOL/TheyCallMeMiku.git
cd TheyCallMeMiku
npm install
```

Prima di avviare il server, configura la voce RVC dal Prompt dei comandi (CMD):

```bat
setupRVC.bat
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