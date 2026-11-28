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
- Miku ricorda il contesto della sessione corrente, mantenendo gli ultimi 12 scambi. La memoria si azzera quando ricarichi la pagina.
- Avatar 3D in formato VRM, con animazioni idle e parlato e ballo.
- Supporto per la voce di Miku: la sintesi vocale locale con SAPI 5 di Windows viene convertita con RVC e riprodotta nel browser con l'animazione sincronizzata.
- Miku decide autonomamente se una richiesta riguarda il repertorio, un'esibizione reale o una semplice conversazione musicale.
- Le richieste di canzoni sono validate contro `miku/songs/SONGS.LIST`; il server controlla che titolo, WAV, VRMA e sfondo appartengano al catalogo e agli asset locali.
- Riproduzione sincronizzata di audio `.wav`, animazione `.vrma` e sfondo dedicato per ogni canzone.
- Effetto fade in/out in nero all'inizio e alla fine di ogni canzone, con durata ridotta per chi usa preferenze di movimento ridotto.
- Palco 3D visibile durante le esibizioni, con piattaforma larga e allungata verso il fondo, bordo luminoso, barre luminose e faretti colorati a intensità controllata.
- Ancoraggio visivo dei piedi al piano del palco durante le coreografie, senza bloccare i movimenti verso l'alto.
- Ripristino automatico di sfondo principale, scala normale dell'avatar e scena standard al termine della canzone o quando l'esibizione viene interrotta.

### Catalogo canzoni

Le canzoni disponibili sono definite in `miku/songs/SONGS.LIST`. Ogni brano contiene almeno un file audio `.wav` e un'animazione `.vrma`, con un'immagine o GIF opzionale usata come sfondo durante l'esecuzione.

Catalogo attuale:

1. Miku di Anamanaguchi
2. Ievan Polkka
3. PoPiPo
4. World is Mine
5. Mesmerizer
6. The Disappearance of Hatsune Miku
7. Triple Baka

I file sono organizzati in sottocartelle dentro `miku/songs/`, per esempio:

```text
miku/songs/
  SONGS.LIST
  mesmerizer/
    mesmerizer.wav
    mesmerizer.vrma
    mesmerizer.gif
```

Quando l'utente chiede quali canzoni può cantare, Miku elenca il catalogo senza avviare la riproduzione. Quando chiede di cantare un brano presente nel catalogo, l'IA usa il titolo esatto del brano e il server risolve i relativi asset locali. Se una richiesta non corrisponde al repertorio, Miku risponde con una battuta scherzosa che indica che non è pronta per quello spettacolo.

Il nome del brano viene accettato anche con l'intera riga numerata completa oppure tramite il titolo normalizzato, per evitare errori dovuti a maiuscole, accenti o spaziatura. Il catalogo viene aggiornato modificando soltanto `miku/songs/SONGS.LIST` e aggiungendo i relativi asset nelle sottocartelle.

### Palco e animazioni

Durante una canzone viene mostrato un palco 3D dedicato:

- Piattaforma più lunga in profondità e allargata rispetto alla schermata normale.
- Bordo frontale luminoso.
- Barre luminose ai lati.
- Faretti colorati attenuati per evitare sovraesposizioni.
- Miku viene leggermente ridimensionata durante l'esibizione.
- Movimento del root limitato su asse orizzontale per mantenere Miku vicina al centro.
- Vincolo visivo dei piedi al piano del palco durante le coreografie.
- I movimenti del torso e degli arti provengono dal VRMA selezionato.

La transizione tra schermata principale e palco è gestita da un overlay nero: sfondo e stage vengono modificati mentre l'immagine è coperta, quindi la schermata riappare con un fade out dell'overlay.

### Comportamento dell'IA e riproduzione

`run.js` legge l'intero contenuto di `SONGS.LIST` e lo passa alle istruzioni del modello. In base al contesto, Miku può:

- Rispondere normalmente senza avviare musica.
- Elencare i brani disponibili.
- Scegliere un titolo quando l'utente chiede genericamente una canzone.
- Avviare un brano locale specifico.
- Rispondere scherzosamente quando il brano non è nel repertorio.

Prima di restituire la riproduzione al browser, il server:

- Individua il titolo selezionato nel catalogo.
- Accetta il titolo esatto o l'intera riga numerata completa.
- Normalizza maiuscole, accenti e punteggiatura per rendere il confronto più robusto.
- Verifica che tutti i percorsi restino dentro `miku/songs/`.
- Controlla l'esistenza dei file `.wav`, `.vrma` e dell'eventuale sfondo.
- Mostra un avviso e annulla la riproduzione se manca un asset richiesto.

Il browser usa poi:

- Il Web Audio API per caricare e riprodurre il WAV.
- Three.js, il caricatore VRM e il caricatore VRMA per renderizzare Miku e l'animazione.
- Una cache delle azioni VRMA già caricate.
- Lo sfondo della canzone tramite una variabile CSS condivisa.
- Il ripristino dello stato iniziale quando il file audio termina o viene premuto Stop.

Il progetto è ancora in sviluppo:

- **Speech-to-text:** non ancora implementato.
- **Easter egg:** altri sono in programma. Per ora, Miku tifa Calcio Catania.

### Configurazione della voce RVC

Per configurare RVC e scaricare automaticamente i file necessari, apri il **Prompt dei comandi (CMD)** nella cartella del progetto ed esegui:

```bat
setupRVC.bat
```

Lo script richiede Git, Python 3.12 e FFmpeg installati e disponibili nel `PATH`. Segui le istruzioni mostrate dal setup; al termine, RVC e il modello vocale di Miku saranno pronti. Il modello è troppo grande per GitHub e viene escluso da Git.

### Sintesi vocale dal terminale (`miku_tts.py`)

`miku_tts.py` serve a generare un WAV con la voce RVC di Miku senza avviare la chat e senza chiamare l'API di OpenAI. Usa SAPI 5 di Windows per creare la voce di partenza, FFmpeg per normalizzare l'audio e il modello RVC locale per convertirlo.

Dopo aver eseguito `setupRVC.bat`, apri un terminale nella cartella del progetto. Per inserire il testo quando richiesto:

```bash
py -3.12 miku_tts.py
```

Puoi anche passare il testo direttamente:

```bash
py -3.12 miku_tts.py "Ciao, sono Miku!"
```

Per scegliere dove salvare il WAV:

```bash
py -3.12 miku_tts.py "Ciao, sono Miku!" --output "audio\miku.wav"
```

Per impostazione predefinita, il file viene salvato in `generated-audio` con un nome univoco. Se il file di destinazione esiste già, lo script si ferma: aggiungi `--overwrite` per autorizzarne la sovrascrittura. Sono richiesti Windows, una voce SAPI 5 (preferibilmente italiana), FFmpeg e i file RVC configurati dal setup. Lo script usa prima l'ambiente Python di RVC, se presente; `RVC_PYTHON` e `FFMPEG_PATH` permettono di indicare percorsi alternativi. Il testo deve contenere al massimo 1000 caratteri.

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
- Strumento per la conversione FBX in VRMA: [tk256ailab/fbx2vrma-converter](https://github.com/tk256ailab/fbx2vrma-converter).
- Animazioni in VRMA: [Kiu-Q/hikari-archive](https://github.com/Kiu-Q/hikari-archive)
- AUDIO2AUDIO RVC Repo: [RVC-Project/Retrieval-based-Voice-Conversion-WebUI](https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI)
- Modello VRM di Miku: era bundled con World is Mine
- Tutti i VMD poi convertiti in VRM: nella cartella /miku/songs/ si trovano i crediti nelle rispettive sottocartelle
